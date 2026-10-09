import { randomUUID } from 'crypto'
import { promises as fsp } from 'fs'
import type { FileHandle } from 'fs/promises'
import type { SFTPWrapper } from 'ssh2'
import { broadcast, toast } from '../broadcast'
import { bus } from '../bus'
import { prompt } from '../prompter'
import { sessions } from '../ssh/SessionManager'
import type { Session } from '../ssh/Session'
import { localFs } from '../fs/LocalFs'
import { RemoteFs } from '../fs/RemoteFs'
import type { FsAdapter } from '../fs/types'
import { settings } from '../store/settings'
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

/** Керування одним активним перенесенням: пауза, скасування */
class Ctrl {
  paused = false
  cancelled = false
  aborted = false
  private waiters: (() => void)[] = []

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
    this.resume()
  }
  abort(): void {
    this.aborted = true
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
  /** Усі дії над елементом завершено, включно з видаленням джерела */
  settled?: boolean
}

interface Batch {
  srcFs: FsAdapter
  move: boolean
  /** Теки-джерела для переміщення, глибші спочатку */
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
            it.error = 'Сесію відключено'
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
        toast('info', 'З’єднання відновлено', `Передачі продовжено: ${requeued}`)
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

  private adapters(session: Session, direction: TransferItem['direction']): { srcFs: FsAdapter; dstFs: FsAdapter } {
    const remote = new RemoteFs(session)
    return direction === 'upload' ? { srcFs: localFs, dstFs: remote } : { srcFs: remote, dstFs: localFs }
  }

  private push(partial: Omit<TransferItem, 'id' | 'transferred' | 'status' | 'speed'>, batchId: string, srcMtime?: number): void {
    const item: TransferItem = { ...partial, id: randomUUID(), transferred: 0, status: 'queued', speed: 0 }
    this.items.push(item)
    this.internal.set(item.id, { batchId, srcMtime, deleteSource: this.batches.get(batchId)?.move })
    this.emit()
    this.schedule()
  }

  /** Після завершення всіх елементів пакета переміщення прибираємо порожні теки-джерела */
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
        /* тека не порожня: щось пропущено або не вдалося */
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
      toast('error', 'Тека призначення недоступна', e instanceof Error ? e.message : String(e))
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
        toast('error', `Не вдалося додати ${src.name}`, e instanceof Error ? e.message : String(e))
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
    session: Session,
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
      if (!session) throw new Error('Сесію закрито')
      if (!session.isConnected) {
        meta.autoRetry = session.info.status === 'reconnecting' || session.info.status === 'connecting'
        throw new Error(meta.autoRetry ? 'Очікування відновлення з’єднання' : 'Сесію не підключено')
      }
      const { srcFs, dstFs } = this.adapters(session, item.direction)
      const srcStat = await srcFs.stat(item.src)
      item.size = srcStat.size
      meta.srcMtime = srcStat.mtime

      if (item.resumeFrom === undefined) {
        const dstStat = await dstFs.stat(item.dst).catch(() => null)
        if (dstStat) {
          const decision = await this.decide(item, meta, srcStat.size, srcStat.mtime, dstStat.size, dstStat.mtime)
          if (decision === 'cancel') {
            this.cancelBatch(meta.batchId)
            item.status = 'cancelled'
            return
          }
          if (decision === 'skip') {
            item.status = 'skipped'
            return
          }
          if (decision === 'resume') {
            if (dstStat.size < srcStat.size) item.resumeFrom = dstStat.size
            else {
              item.status = 'skipped'
              return
            }
          }
        }
      }

      if (item.direction === 'download') await this.downloadFile(session, item, ctrl)
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
        /* не критично */
      }
      if (meta.deleteSource) {
        try {
          await srcFs.remove(item.src, false)
        } catch (e) {
          toast('warning', `Не вдалося видалити джерело ${item.name}`, e instanceof Error ? e.message : String(e))
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
    dstMtime: number
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
      canResume: dstSize < srcSize
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
            if (n === 0) throw new Error('Файл на сервері став коротшим під час передачі')
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
            if (bytesRead === 0) throw new Error('Локальний файл став коротшим під час передачі')
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
   * Паралельний конвеєр читання та запису блоками.
   * Повертає зміщення, до якого дані гарантовано записані без пропусків.
   */
  private async pump(
    ctrl: Ctrl,
    item: TransferItem,
    start: number,
    size: number,
    read: (buf: Buffer, off: number, len: number) => Promise<void>,
    write: (buf: Buffer, off: number, len: number) => Promise<void>
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
          const len = Math.min(CHUNK, size - off)
          next += len
          const buf = Buffer.allocUnsafe(len)
          await read(buf, off, len)
          if (ctrl.stop) return
          await write(buf, off, len)
          item.transferred += len
          done.add(off)
          while (done.has(committed)) {
            done.delete(committed)
            committed += CHUNK
          }
        }
      } catch (e) {
        if (!firstError) firstError = e
        ctrl.abort()
      }
    }

    const n = Math.max(1, Math.min(CONCURRENT_CHUNKS, Math.ceil((size - start) / CHUNK)))
    await Promise.all(Array.from({ length: n }, worker))
    if (firstError) {
      item.resumeFrom = committed
      throw firstError
    }
    return Math.min(committed, size)
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
    this.internal.delete(id)
    this.emit()
  }

  clearFinished(): void {
    const keep = new Set(['running', 'queued', 'paused', 'scanning'])
    this.items = this.items.filter((i) => keep.has(i.status))
    for (const id of [...this.internal.keys()]) {
      if (!this.items.some((i) => i.id === id)) this.internal.delete(id)
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
