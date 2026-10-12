import { randomUUID } from 'crypto'
import { promises as fsp } from 'fs'
import type { FileHandle } from 'fs/promises'
import { Readable } from 'stream'
import type { SFTPWrapper } from 'ssh2'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { broadcast, toast } from '../broadcast'
import { bus } from '../bus'
import { prompt } from '../prompter'
import { sessions, type AnySession } from '../ssh/SessionManager'
import type { Session } from '../ssh/Session'
import { S3Session, s3ErrorInfo } from '../s3/S3Session'
import { contentTypeFor } from '../s3/mime'
import { localFs } from '../fs/LocalFs'
import { sessionFs } from '../fs'
import { parseS3Path } from '../fs/S3Fs'
import type { FsAdapter } from '../fs/types'
import { settings } from '../store/settings'
import { tr } from '../i18n'
import { sftpClose, sftpOpen, sftpRead, sftpSetstat, sftpWrite } from '../fs/sftpUtil'
import type {
  OverwriteAnswer,
  OverwritePolicy,
  SessionInfo,
  TransferItem,
  TransferRequest,
  TransferSummary
} from '@shared/types'

const CHUNK = 32 * 1024
const CONCURRENT_CHUNKS = 32

const MiB = 1024 * 1024
/** S3 downloads: ranged GETs */
const S3_CHUNK = 8 * MiB
const S3_DOWNLOAD_CONCURRENCY = 4
/** S3 uploads: parts of at least 5 MiB (S3's minimum), at most 10,000 of them */
const S3_PART = 8 * MiB
const S3_MAX_PARTS = 10_000
const S3_UPLOAD_CONCURRENCY = 4
/** Smaller files go up in one PUT */
const S3_MULTIPART_MIN = 16 * MiB
const S3_ATTEMPTS = 3

/** A request body that reports bytes as the HTTP layer reads them, so progress moves within a part */
function countingBody(data: Buffer, onBytes: (n: number) => void): Readable {
  const STEP = 64 * 1024
  let off = 0
  return new Readable({
    read() {
      if (off >= data.length) {
        this.push(null)
        return
      }
      const piece = data.subarray(off, Math.min(off + STEP, data.length))
      off += piece.length
      onBytes(piece.length)
      this.push(piece)
    }
  })
}

/** Controls one active transfer: pause, cancel */
class Ctrl {
  paused = false
  cancelled = false
  aborted = false
  private waiters: (() => void)[] = []
  private controller = new AbortController()

  /** Aborted on cancel or error, which stops in-flight S3 requests at once */
  get signal(): AbortSignal {
    return this.controller.signal
  }

  waitIfPaused(): Promise<void> {
    if (!this.paused) return Promise.resolve()
    return new Promise((r) => this.waiters.push(r))
  }
  pause(): void {
    this.paused = true
  }
  resume(): void {
    this.paused = false
    this.waiters.splice(0).forEach((f) => f())
  }
  cancel(): void {
    this.cancelled = true
    this.controller.abort()
    this.resume()
  }
  abort(): void {
    this.aborted = true
    this.controller.abort()
    this.resume()
  }
  get stop(): boolean {
    return this.cancelled || this.aborted
  }
}

interface Internal {
  batchId: string
  ctrl?: Ctrl
  autoRetry?: boolean
  srcMtime?: number
  deleteSource?: boolean
  /** All actions on the item are finished, including deleting the source */
  settled?: boolean
  /** S3 multipart upload kept across pause, error and retry; aborted on cancel or removal so parts don't linger */
  s3Upload?: S3Upload
  /** ETag of the S3 object being downloaded: a resume must continue the same version */
  s3ETag?: string
}

interface S3Upload {
  sessionId: string
  uploadId: string
  bucket: string
  key: string
  partSize: number
  /** part number -> ETag */
  parts: Map<number, string>
}

interface Batch {
  srcFs: FsAdapter
  move: boolean
  /** Source folders of a move, deepest first */
  dirs: string[]
}

type BatchDecision = OverwritePolicy | 'cancel'

class TransferManager {
  private items: TransferItem[] = []
  private internal = new Map<string, Internal>()
  private batchDecision = new Map<string, BatchDecision>()
  private batchRequested = new Map<string, OverwritePolicy>()
  private batches = new Map<string, Batch>()
  private running = 0
  private ticker?: NodeJS.Timeout
  private emitTimer?: NodeJS.Timeout
  private lastSample = new Map<string, { t: number; b: number }>()

  constructor() {
    bus.on('session:update', (info: SessionInfo) => {
      if (info.status === 'reconnecting' || info.status === 'disconnected' || info.status === 'error') {
        for (const it of this.items) {
          if (it.sessionId === info.id && (it.status === 'running' || it.status === 'queued')) {
            const meta = this.internal.get(it.id)
            if (meta) meta.autoRetry = info.status === 'reconnecting'
          }
        }
      }
      if (info.status === 'disconnected') {
        for (const it of this.items) {
          if (it.sessionId === info.id && it.status === 'queued') {
            it.status = 'error'
            it.error = tr().main.session.disconnected
          }
        }
        this.emit()
      }
    })
    bus.on('session:reconnected', (id: string) => {
      let requeued = 0
      for (const it of this.items) {
        const meta = this.internal.get(it.id)
        if (it.sessionId === id && it.status === 'error' && meta?.autoRetry) {
          meta.autoRetry = false
          it.status = 'queued'
          it.error = undefined
          requeued++
        }
      }
      if (requeued) {
        toast('info', tr().main.transfer.reconnected, tr().main.transfer.resumed(requeued))
        this.schedule()
      }
    })
  }

  summary(): TransferSummary {
    const active = this.items.filter((i) => i.status === 'running').length
    const totalSpeed = this.items.reduce((s, i) => (i.status === 'running' ? s + i.speed : s), 0)
    return { items: this.items, active, totalSpeed }
  }

  private emit(): void {
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined
      broadcast('transfer:update', this.summary())
    }, 80)
  }

  private startTicker(): void {
    if (this.ticker) return
    this.ticker = setInterval(() => {
      const now = Date.now()
      for (const it of this.items) {
        if (it.status !== 'running') {
          this.lastSample.delete(it.id)
          continue
        }
        const prev = this.lastSample.get(it.id)
        if (prev) {
          const dt = (now - prev.t) / 1000
          if (dt > 0) {
            const inst = (it.transferred - prev.b) / dt
            it.speed = it.speed > 0 ? it.speed * 0.6 + inst * 0.4 : inst
          }
        }
        this.lastSample.set(it.id, { t: now, b: it.transferred })
      }
      this.emit()
      if (this.running === 0) {
        clearInterval(this.ticker)
        this.ticker = undefined
      }
    }, 500)
  }

  private adapters(session: AnySession, direction: TransferItem['direction']): { srcFs: FsAdapter; dstFs: FsAdapter } {
    const remote = sessionFs(session)
    return direction === 'upload' ? { srcFs: localFs, dstFs: remote } : { srcFs: remote, dstFs: localFs }
  }

  private push(partial: Omit<TransferItem, 'id' | 'transferred' | 'status' | 'speed'>, batchId: string, srcMtime?: number): void {
    const item: TransferItem = { ...partial, id: randomUUID(), transferred: 0, status: 'queued', speed: 0 }
    this.items.push(item)
    this.internal.set(item.id, { batchId, srcMtime, deleteSource: this.batches.get(batchId)?.move })
    this.emit()
    this.schedule()
  }

  /** Once every item of a move batch is done, remove the empty source folders */
  private async finishBatch(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId)
    if (!batch) return
    const pending = this.items.some((i) => {
      const m = this.internal.get(i.id)
      return m?.batchId === batchId && !m.settled
    })
    if (pending) return
    this.batches.delete(batchId)
    if (!batch.move) return
    for (const dir of batch.dirs) {
      try {
        await batch.srcFs.rmdir(dir)
      } catch {
        /* folder not empty: something was skipped or failed */
      }
    }
  }

  async enqueue(req: TransferRequest): Promise<void> {
    const session = sessions.require(req.sessionId)
    const { srcFs, dstFs } = this.adapters(session, req.direction)
    const batchId = randomUUID()
    if (req.policy && req.policy !== 'ask') this.batchRequested.set(batchId, req.policy)
    this.batches.set(batchId, { srcFs, move: !!req.move, dirs: [] })
    try {
      await dstFs.ensureDir(req.destDir)
    } catch (e) {
      toast('error', tr().main.transfer.destUnavailable, e instanceof Error ? e.message : String(e))
      return
    }

    for (const src of req.sources) {
      const dst = dstFs.join(req.destDir, src.name)
      try {
        if (!src.isDir) {
          const st = await srcFs.stat(src.path)
          this.push(
            {
              sessionId: req.sessionId,
              sessionName: session.info.name,
              direction: req.direction,
              src: src.path,
              dst,
              name: src.name,
              size: st.size
            },
            batchId,
            st.mtime
          )
        } else {
          await this.expandDir(src.path, dst, srcFs, dstFs, req, session, batchId)
        }
      } catch (e) {
        toast('error', tr().main.transfer.addFailed(src.name), e instanceof Error ? e.message : String(e))
      }
    }
    void this.finishBatch(batchId)
  }

  private async expandDir(
    srcDir: string,
    dstDir: string,
    srcFs: FsAdapter,
    dstFs: FsAdapter,
    req: TransferRequest,
    session: AnySession,
    batchId: string
  ): Promise<void> {
    await dstFs.ensureDir(dstDir)
    const entries = await srcFs.list(srcDir)
    for (const e of entries) {
      if (e.isDir) {
        await this.expandDir(e.path, dstFs.join(dstDir, e.name), srcFs, dstFs, req, session, batchId)
      } else {
        this.push(
          {
            sessionId: req.sessionId,
            sessionName: session.info.name,
            direction: req.direction,
            src: e.path,
            dst: dstFs.join(dstDir, e.name),
            name: e.name,
            size: e.size
          },
          batchId,
          e.mtime
        )
      }
    }
    this.batches.get(batchId)?.dirs.push(srcDir)
  }

  private schedule(): void {
    const conc = Math.max(1, Math.min(8, settings.get().transferConcurrency || 2))
    while (this.running < conc) {
      const next = this.items.find((i) => i.status === 'queued')
      if (!next) break
      void this.run(next)
    }
  }

  private async run(item: TransferItem): Promise<void> {
    this.running++
    const meta = this.internal.get(item.id) ?? { batchId: '' }
    const ctrl = new Ctrl()
    meta.ctrl = ctrl
    item.status = 'running'
    item.startedAt = Date.now()
    item.error = undefined
    item.speed = 0
    this.emit()
    this.startTicker()

    try {
      const session = sessions.get(item.sessionId)
      if (!session) throw new Error(tr().main.session.closed)
      if (!session.isConnected) {
        meta.autoRetry = session.info.status === 'reconnecting' || session.info.status === 'connecting'
        throw new Error(meta.autoRetry ? tr().main.transfer.waitingForReconnect : tr().main.session.notConnected)
      }
      const { srcFs, dstFs } = this.adapters(session, item.direction)
      const srcStat = await srcFs.stat(item.src)
      item.size = srcStat.size
      meta.srcMtime = srcStat.mtime

      // An S3 object cannot be appended to, so an upload over a shorter object starts over
      const appendable = !(session instanceof S3Session && item.direction === 'upload')
      if (item.resumeFrom === undefined) {
        const dstStat = await dstFs.stat(item.dst).catch(() => null)
        if (dstStat) {
          const decision = await this.decide(item, meta, srcStat.size, srcStat.mtime, dstStat.size, dstStat.mtime, appendable)
          if (decision === 'cancel') {
            this.cancelBatch(meta.batchId)
            item.status = 'cancelled'
            return
          }
          if (decision === 'skip') {
            item.status = 'skipped'
            return
          }
          if (decision === 'resume' && appendable) {
            if (dstStat.size < srcStat.size) item.resumeFrom = dstStat.size
            else {
              item.status = 'skipped'
              return
            }
          }
        }
      }

      if (session instanceof S3Session) {
        if (item.direction === 'download') await this.downloadS3(session, item, ctrl, meta)
        else await this.uploadS3(session, item, ctrl, meta)
      } else if (item.direction === 'download') await this.downloadFile(session, item, ctrl)
      else await this.uploadFile(session, item, ctrl)

      if (ctrl.cancelled) {
        item.status = 'cancelled'
        return
      }
      item.transferred = item.size
      item.status = 'done'
      item.resumeFrom = undefined
      try {
        await dstFs.utimes(item.dst, Date.now(), srcStat.mtime)
      } catch {
        /* not critical */
      }
      if (meta.deleteSource) {
        try {
          await srcFs.remove(item.src, false)
        } catch (e) {
          toast('warning', tr().main.transfer.deleteSourceFailed(item.name), e instanceof Error ? e.message : String(e))
        }
      }
    } catch (e) {
      item.status = ctrl.cancelled ? 'cancelled' : 'error'
      if (!ctrl.cancelled) item.error = e instanceof Error ? e.message : String(e)
    } finally {
      item.finishedAt = Date.now()
      item.speed = 0
      meta.ctrl = undefined
      this.running--
      meta.settled = true
      this.emit()
      this.schedule()
      void this.finishBatch(meta.batchId)
    }
  }

  private async decide(
    item: TransferItem,
    meta: Internal,
    srcSize: number,
    srcMtime: number,
    dstSize: number,
    dstMtime: number,
    appendable = true
  ): Promise<BatchDecision> {
    const batchChoice = this.batchDecision.get(meta.batchId)
    if (batchChoice) return batchChoice
    const requested = this.batchRequested.get(meta.batchId)
    if (requested && requested !== 'ask') return requested

    const a = await prompt<OverwriteAnswer>('overwrite', {
      direction: item.direction,
      src: item.src,
      dst: item.dst,
      srcSize,
      dstSize,
      srcMtime,
      dstMtime,
      canResume: appendable && dstSize < srcSize
    })
    if (a.applyToAll && a.action !== 'cancel') this.batchDecision.set(meta.batchId, a.action)
    return a.action
  }

  private cancelBatch(batchId: string): void {
    for (const it of this.items) {
      if (this.internal.get(it.id)?.batchId === batchId && (it.status === 'queued' || it.status === 'paused')) {
        it.status = 'cancelled'
      }
    }
  }

  private async downloadFile(session: Session, item: TransferItem, ctrl: Ctrl): Promise<void> {
    const sftp: SFTPWrapper = session.sftp
    const size = item.size
    let start = item.resumeFrom ?? 0
    if (start > size) start = 0
    const handle = await sftpOpen(sftp, item.src, 'r')
    let fd: FileHandle | undefined
    try {
      fd = await fsp.open(item.dst, start > 0 ? 'r+' : 'w')
      if (start > 0) await fd.truncate(start)
      item.transferred = start

      const committed = await this.pump(
        ctrl,
        item,
        start,
        size,
        async (buf, off, len) => {
          let got = 0
          while (got < len) {
            const n = await sftpRead(sftp, handle, buf, got, len - got, off + got)
            if (n === 0) throw new Error(tr().main.transfer.remoteShrank)
            got += n
          }
        },
        async (buf, off, len) => {
          await fd!.write(buf, 0, len, off)
        }
      )
      if (ctrl.stop) {
        item.resumeFrom = committed
        await fd.truncate(committed).catch(() => {})
      }
    } finally {
      await fd?.close().catch(() => {})
      await sftpClose(sftp, handle).catch(() => {})
    }
  }

  private async uploadFile(session: Session, item: TransferItem, ctrl: Ctrl): Promise<void> {
    const sftp: SFTPWrapper = session.sftp
    const size = item.size
    let start = item.resumeFrom ?? 0
    if (start > size) start = 0
    const fd = await fsp.open(item.src, 'r')
    let handle: Buffer | undefined
    try {
      handle = await sftpOpen(sftp, item.dst, start > 0 ? 'r+' : 'w')
      item.transferred = start

      const committed = await this.pump(
        ctrl,
        item,
        start,
        size,
        async (buf, off, len) => {
          let got = 0
          while (got < len) {
            const { bytesRead } = await fd.read(buf, got, len - got, off + got)
            if (bytesRead === 0) throw new Error(tr().main.transfer.localShrank)
            got += bytesRead
          }
        },
        async (buf, off, len) => {
          await sftpWrite(sftp, handle!, buf, 0, len, off)
        }
      )
      if (ctrl.stop) {
        item.resumeFrom = committed
        await sftpClose(sftp, handle).catch(() => {})
        handle = undefined
        await sftpSetstat(sftp, item.dst, { size: committed }).catch(() => {})
      }
    } finally {
      if (handle) await sftpClose(sftp, handle).catch(() => {})
      await fd.close().catch(() => {})
    }
  }

  /**
   * Parallel read/write pipeline working in blocks.
   * Returns the offset up to which the data is guaranteed to be written without gaps.
   */
  private async pump(
    ctrl: Ctrl,
    item: TransferItem,
    start: number,
    size: number,
    read: (buf: Buffer, off: number, len: number, progress: (n: number) => void) => Promise<void>,
    write: (buf: Buffer, off: number, len: number, progress: (n: number) => void) => Promise<void>,
    chunk = CHUNK,
    concurrency = CONCURRENT_CHUNKS
  ): Promise<number> {
    let next = start
    let committed = start
    const done = new Set<number>()
    let firstError: unknown = null

    const worker = async (): Promise<void> => {
      try {
        for (;;) {
          if (ctrl.paused && !ctrl.stop) {
            if (item.status === 'running') {
              item.status = 'paused'
              this.emit()
            }
            await ctrl.waitIfPaused()
            if (!ctrl.stop && item.status === 'paused') {
              item.status = 'running'
              this.emit()
            }
          }
          if (ctrl.stop) return
          if (next >= size) return
          const off = next
          const len = Math.min(chunk, size - off)
          next += len
          const buf = Buffer.allocUnsafe(len)
          // Large S3 chunks report progress while they travel; the rest is added once the chunk is done
          let reported = 0
          const progress = (n: number): void => {
            reported += n
            item.transferred += n
          }
          await read(buf, off, len, progress)
          if (ctrl.stop) {
            item.transferred -= reported
            return
          }
          await write(buf, off, len, progress)
          item.transferred += len - reported
          done.add(off)
          while (done.has(committed)) {
            done.delete(committed)
            committed += chunk
          }
        }
      } catch (e) {
        if (!firstError) firstError = e
        ctrl.abort()
      }
    }

    const n = Math.max(1, Math.min(concurrency, Math.ceil((size - start) / chunk)))
    await Promise.all(Array.from({ length: n }, worker))
    if (firstError) {
      item.resumeFrom = committed
      throw firstError
    }
    return Math.min(committed, size)
  }

  /** One S3 request with its own retries; progress reported by a failed attempt is taken back */
  private async s3Attempt<T>(ctrl: Ctrl, progress: (n: number) => void, run: (progress: (n: number) => void) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      let reported = 0
      try {
        return await run((n) => {
          reported += n
          progress(n)
        })
      } catch (e) {
        progress(-reported)
        if (ctrl.stop || attempt >= S3_ATTEMPTS || s3ErrorInfo(e).status === 412) throw e
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
  }

  private async downloadS3(session: S3Session, item: TransferItem, ctrl: Ctrl, meta: Internal): Promise<void> {
    const client = session.require()
    const loc = parseS3Path(item.src)
    if (!loc?.key) throw new Error(tr().main.fs.isFolder)
    const size = item.size
    let start = item.resumeFrom ?? 0
    if (start > size) start = 0
    const head = await client.send(new HeadObjectCommand({ Bucket: loc.bucket, Key: loc.key }), { abortSignal: ctrl.signal })
    if (start > 0 && meta.s3ETag && head.ETag !== meta.s3ETag) start = 0
    meta.s3ETag = head.ETag
    let fd: FileHandle | undefined
    try {
      fd = await fsp.open(item.dst, start > 0 ? 'r+' : 'w')
      if (start > 0) await fd.truncate(start)
      item.transferred = start
      const committed = await this.pump(
        ctrl,
        item,
        start,
        size,
        (buf, off, len, progress) =>
          this.s3Attempt(ctrl, progress, async (report) => {
            let r
            try {
              r = await client.send(
                new GetObjectCommand({ Bucket: loc.bucket, Key: loc.key, Range: `bytes=${off}-${off + len - 1}`, IfMatch: head.ETag }),
                { abortSignal: ctrl.signal }
              )
            } catch (e) {
              if (s3ErrorInfo(e).status === 412) throw new Error(tr().main.s3.changedDuringTransfer)
              throw e
            }
            let got = 0
            for await (const piece of r.Body as Readable) {
              const bytes = piece as Buffer
              if (got + bytes.length > len) throw new Error(tr().main.s3.changedDuringTransfer)
              bytes.copy(buf, got)
              got += bytes.length
              report(bytes.length)
            }
            if (got !== len) throw new Error(tr().main.transfer.remoteShrank)
          }),
        async (buf, off, len) => {
          await fd!.write(buf, 0, len, off)
        },
        S3_CHUNK,
        S3_DOWNLOAD_CONCURRENCY
      )
      if (ctrl.stop) {
        item.resumeFrom = committed
        await fd.truncate(committed).catch(() => {})
      }
    } finally {
      await fd?.close().catch(() => {})
    }
  }

  private async uploadS3(session: S3Session, item: TransferItem, ctrl: Ctrl, meta: Internal): Promise<void> {
    const client = session.require()
    const loc = parseS3Path(item.dst)
    if (!loc?.key) throw new Error(tr().main.fs.isFolder)
    const size = item.size
    const ContentType = contentTypeFor(loc.key)
    const progress = (n: number): void => {
      item.transferred += n
    }

    if (size < S3_MULTIPART_MIN) {
      const data = await fsp.readFile(item.src)
      item.transferred = 0
      await this.s3Attempt(ctrl, progress, (report) =>
        client.send(
          new PutObjectCommand({ Bucket: loc.bucket, Key: loc.key, Body: countingBody(data, report), ContentLength: data.length, ContentType }),
          { abortSignal: ctrl.signal }
        )
      )
      item.resumeFrom = undefined
      return
    }

    const partSize = Math.max(S3_PART, Math.ceil(size / S3_MAX_PARTS / MiB) * MiB)
    let start = item.resumeFrom ?? 0
    let up = meta.s3Upload
    if (!up || start === 0 || up.partSize !== partSize || up.bucket !== loc.bucket || up.key !== loc.key) {
      if (up) await this.abortS3Upload(up)
      const r = await client.send(new CreateMultipartUploadCommand({ Bucket: loc.bucket, Key: loc.key, ContentType }), { abortSignal: ctrl.signal })
      up = { sessionId: item.sessionId, uploadId: r.UploadId!, bucket: loc.bucket, key: loc.key, partSize, parts: new Map() }
      meta.s3Upload = up
      start = 0
    }
    start -= start % partSize
    const upload = up
    const fd = await fsp.open(item.src, 'r')
    try {
      item.transferred = start
      await this.pump(
        ctrl,
        item,
        start,
        size,
        async (buf, off, len) => {
          let got = 0
          while (got < len) {
            const { bytesRead } = await fd.read(buf, got, len - got, off + got)
            if (bytesRead === 0) throw new Error(tr().main.transfer.localShrank)
            got += bytesRead
          }
        },
        async (buf, off, len, report) => {
          const PartNumber = off / partSize + 1
          const r = await this.s3Attempt(ctrl, report, (attemptReport) =>
            client.send(
              new UploadPartCommand({
                Bucket: upload.bucket,
                Key: upload.key,
                UploadId: upload.uploadId,
                PartNumber,
                Body: countingBody(buf.subarray(0, len), attemptReport),
                ContentLength: len
              }),
              { abortSignal: ctrl.signal }
            )
          )
          upload.parts.set(PartNumber, r.ETag!)
        },
        partSize,
        partSize > 64 * MiB ? 2 : S3_UPLOAD_CONCURRENCY
      )
      if (ctrl.cancelled) return
      const total = Math.ceil(size / partSize)
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: upload.bucket,
          Key: upload.key,
          UploadId: upload.uploadId,
          MultipartUpload: { Parts: Array.from({ length: total }, (_, i) => ({ PartNumber: i + 1, ETag: upload.parts.get(i + 1) })) }
        })
      )
      meta.s3Upload = undefined
      item.resumeFrom = undefined
    } finally {
      await fd.close().catch(() => {})
      if (ctrl.cancelled && meta.s3Upload) {
        await this.abortS3Upload(meta.s3Upload)
        meta.s3Upload = undefined
        item.resumeFrom = undefined
      }
    }
  }

  /** Drops the uploaded parts; S3 bills for them until the upload is completed or aborted */
  private async abortS3Upload(up: S3Upload): Promise<void> {
    const s = sessions.get(up.sessionId)
    if (!(s instanceof S3Session) || !s.isConnected) return
    try {
      await s.require().send(new AbortMultipartUploadCommand({ Bucket: up.bucket, Key: up.key, UploadId: up.uploadId }))
    } catch {
      /* already gone, or the session lost access */
    }
  }

  /** Called on quit: unfinished uploads would otherwise keep their parts on S3 */
  async abortPendingS3Uploads(): Promise<void> {
    const pending = [...this.internal.values()].map((m) => m.s3Upload).filter((u): u is S3Upload => !!u)
    await Promise.all(pending.map((u) => this.abortS3Upload(u)))
  }

  pause(id: string): void {
    const it = this.items.find((i) => i.id === id)
    if (!it) return
    const meta = this.internal.get(id)
    if (it.status === 'queued') it.status = 'paused'
    else if (it.status === 'running') meta?.ctrl?.pause()
    this.emit()
  }

  resume(id: string): void {
    const it = this.items.find((i) => i.id === id)
    if (!it || it.status !== 'paused') return
    const meta = this.internal.get(id)
    if (meta?.ctrl) {
      meta.ctrl.resume()
      it.status = 'running'
    } else {
      it.status = 'queued'
    }
    this.emit()
    this.schedule()
  }

  cancel(id: string): void {
    const it = this.items.find((i) => i.id === id)
    if (!it) return
    const meta = this.internal.get(id)
    if (it.status === 'running' || (it.status === 'paused' && meta?.ctrl)) meta?.ctrl?.cancel()
    else if (it.status === 'queued' || it.status === 'paused') it.status = 'cancelled'
    this.emit()
  }

  retry(id: string): void {
    const it = this.items.find((i) => i.id === id)
    if (!it) return
    if (it.status === 'error' || it.status === 'cancelled' || it.status === 'skipped') {
      if (it.status === 'skipped') it.resumeFrom = undefined
      const m = this.internal.get(id)
      if (m) m.settled = false
      it.status = 'queued'
      it.error = undefined
      it.transferred = it.resumeFrom ?? 0
      this.emit()
      this.schedule()
    }
  }

  remove(id: string): void {
    const it = this.items.find((i) => i.id === id)
    if (!it || it.status === 'running') return
    this.items = this.items.filter((i) => i.id !== id)
    const up = this.internal.get(id)?.s3Upload
    if (up) void this.abortS3Upload(up)
    this.internal.delete(id)
    this.emit()
  }

  clearFinished(): void {
    const keep = new Set(['running', 'queued', 'paused', 'scanning'])
    this.items = this.items.filter((i) => keep.has(i.status))
    for (const [id, m] of [...this.internal.entries()]) {
      if (this.items.some((i) => i.id === id)) continue
      if (m.s3Upload) void this.abortS3Upload(m.s3Upload)
      this.internal.delete(id)
    }
    this.emit()
  }

  cancelAll(): void {
    for (const it of this.items) {
      if (it.status === 'running' || it.status === 'paused' || it.status === 'queued') this.cancel(it.id)
    }
  }
}

export const transfers = new TransferManager()
