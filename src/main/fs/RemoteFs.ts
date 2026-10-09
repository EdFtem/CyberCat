import { posix } from 'path'
import { randomBytes } from 'crypto'
import type { SFTPWrapper } from 'ssh2'
import type { DiskUsage, FileEntry } from '@shared/types'
import type { Session } from '../ssh/Session'
import { FsAdapter, permBits } from './types'
import {
  sftpChmod,
  sftpClose,
  sftpFstat,
  sftpLstat,
  sftpMkdir,
  sftpOpen,
  sftpPosixRename,
  sftpRead,
  sftpReaddir,
  sftpReadlink,
  sftpRealpath,
  sftpRename,
  sftpRmdir,
  sftpStat,
  sftpStatVfs,
  sftpUnlink,
  sftpUtimes,
  sftpWrite,
  shq,
  sftpCode,
  SFTP_NO_SUCH_FILE
} from './sftpUtil'

const S_IFMT = 0o170000
const S_IFDIR = 0o040000
const S_IFLNK = 0o120000

const READ_CHUNK = 64 * 1024
const WRITE_CHUNK = 32 * 1024
const CONCURRENCY = 16

function parseLongname(longname: string | undefined): { owner?: string; group?: string } {
  if (!longname) return {}
  const parts = longname.trim().split(/\s+/)
  if (parts.length >= 5 && /^\d+$/.test(parts[1])) return { owner: parts[2], group: parts[3] }
  return {}
}

/** Паралельне читання всього вмісту дескриптора */
export async function readFromHandle(
  sftp: SFTPWrapper,
  handle: Buffer,
  size: number,
  maxBytes = Infinity
): Promise<{ data: Buffer; truncated: boolean }> {
  const len = Math.min(size, maxBytes)
  const buf = Buffer.allocUnsafe(len)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < len) {
      const off = next
      const want = Math.min(READ_CHUNK, len - off)
      next += want
      let got = 0
      while (got < want) {
        const n = await sftpRead(sftp, handle, buf, off + got, want - got, off + got)
        if (n === 0) throw new Error('Несподіваний кінець файлу під час читання')
        got += n
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.ceil(len / READ_CHUNK) || 1) }, worker))
  return { data: buf, truncated: size > len }
}

/** Паралельний запис буфера у дескриптор */
export async function writeToHandle(sftp: SFTPWrapper, handle: Buffer, data: Buffer): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < data.length) {
      const off = next
      const len = Math.min(WRITE_CHUNK, data.length - off)
      next += len
      await sftpWrite(sftp, handle, data, off, len, off)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.ceil(data.length / WRITE_CHUNK) || 1) }, worker))
}

export class RemoteFs implements FsAdapter {
  readonly kind = 'remote' as const
  readonly sep = '/'

  constructor(private session: Session) {}

  private get sftp(): SFTPWrapper {
    return this.session.sftp
  }

  join(...parts: string[]): string {
    return posix.join(...parts)
  }
  dirname(p: string): string {
    return posix.dirname(p)
  }
  basename(p: string): string {
    return posix.basename(p)
  }

  async home(): Promise<string> {
    return this.session.info.homeDir ?? (await sftpRealpath(this.sftp, '.'))
  }

  async realpath(p: string): Promise<string> {
    return sftpRealpath(this.sftp, p)
  }

  async list(p: string): Promise<FileEntry[]> {
    const sftp = this.sftp
    const raw = await sftpReaddir(sftp, p)
    const entries: FileEntry[] = []
    for (const r of raw) {
      if (r.filename === '.' || r.filename === '..') continue
      const type = r.attrs.mode & S_IFMT
      const isSymlink = type === S_IFLNK
      const isDir = type === S_IFDIR
      entries.push({
        name: r.filename,
        path: posix.join(p, r.filename),
        isDir,
        isSymlink,
        size: isDir ? 0 : r.attrs.size,
        mtime: r.attrs.mtime * 1000,
        mode: permBits(r.attrs.mode),
        ...parseLongname(r.longname)
      })
    }

    const links = entries.filter((e) => e.isSymlink)
    for (let i = 0; i < links.length; i += CONCURRENCY) {
      await Promise.all(
        links.slice(i, i + CONCURRENCY).map(async (e) => {
          try {
            const st = await sftpStat(sftp, e.path)
            e.isDir = st.isDirectory()
            e.size = e.isDir ? 0 : st.size
          } catch {
            /* обірване посилання */
          }
          try {
            e.linkTarget = await sftpReadlink(sftp, e.path)
          } catch {
            /* ignore */
          }
        })
      )
    }
    return entries
  }

  async stat(p: string): Promise<FileEntry> {
    const sftp = this.sftp
    const lst = await sftpLstat(sftp, p)
    const isSymlink = lst.isSymbolicLink()
    const st = isSymlink ? await sftpStat(sftp, p).catch(() => lst) : lst
    return {
      name: posix.basename(p) || '/',
      path: p,
      isDir: st.isDirectory(),
      isSymlink,
      size: st.isDirectory() ? 0 : st.size,
      mtime: st.mtime * 1000,
      mode: permBits(st.mode)
    }
  }

  async mkdir(p: string): Promise<void> {
    await sftpMkdir(this.sftp, p)
  }

  async ensureDir(p: string): Promise<void> {
    try {
      await sftpMkdir(this.sftp, p)
    } catch (e) {
      try {
        const st = await sftpStat(this.sftp, p)
        if (st.isDirectory()) return
        throw new Error(`Шлях існує, але це не тека: ${p}`)
      } catch (statErr) {
        if (sftpCode(statErr) === SFTP_NO_SUCH_FILE && posix.dirname(p) !== p) {
          await this.ensureDir(posix.dirname(p))
          await sftpMkdir(this.sftp, p)
          return
        }
        throw e
      }
    }
  }

  async rename(from: string, to: string): Promise<void> {
    await sftpRename(this.sftp, from, to)
  }

  async remove(p: string, isDir: boolean): Promise<void> {
    if (!isDir) {
      await sftpUnlink(this.sftp, p)
      return
    }
    if (this.session.info.hasShell) {
      const r = await this.session.exec(`rm -rf -- ${shq(p)}`, 10 * 60_000)
      if (r.code !== 0) throw new Error(r.stderr.trim() || `rm завершився з кодом ${r.code}`)
      return
    }
    await this.removeRecursive(p)
  }

  private async removeRecursive(p: string): Promise<void> {
    const sftp = this.sftp
    const items = await sftpReaddir(sftp, p)
    for (const it of items) {
      if (it.filename === '.' || it.filename === '..') continue
      const full = posix.join(p, it.filename)
      if ((it.attrs.mode & S_IFMT) === S_IFDIR) await this.removeRecursive(full)
      else await sftpUnlink(sftp, full)
    }
    await sftpRmdir(sftp, p)
  }

  async chmod(p: string, mode: number, recursive: boolean): Promise<void> {
    if (!recursive) {
      await sftpChmod(this.sftp, p, mode)
      return
    }
    if (this.session.info.hasShell) {
      const r = await this.session.exec(`chmod -R ${mode.toString(8)} -- ${shq(p)}`, 10 * 60_000)
      if (r.code !== 0) throw new Error(r.stderr.trim() || `chmod завершився з кодом ${r.code}`)
      return
    }
    await this.chmodRecursive(p, mode)
  }

  private async chmodRecursive(p: string, mode: number): Promise<void> {
    const sftp = this.sftp
    await sftpChmod(sftp, p, mode)
    const st = await sftpLstat(sftp, p)
    if (!st.isDirectory()) return
    const items = await sftpReaddir(sftp, p)
    for (const it of items) {
      if (it.filename === '.' || it.filename === '..') continue
      if ((it.attrs.mode & S_IFMT) === S_IFLNK) continue
      await this.chmodRecursive(posix.join(p, it.filename), mode)
    }
  }

  async createFile(p: string): Promise<void> {
    const h = await sftpOpen(this.sftp, p, 'wx')
    await sftpClose(this.sftp, h)
  }

  async readFile(p: string, maxBytes = Infinity): Promise<{ data: Buffer; truncated: boolean }> {
    const sftp = this.sftp
    const h = await sftpOpen(sftp, p, 'r')
    try {
      const st = await sftpFstat(sftp, h)
      return await readFromHandle(sftp, h, st.size, maxBytes)
    } finally {
      await sftpClose(sftp, h).catch(() => {})
    }
  }

  async readRange(p: string, start: number, length: number): Promise<Buffer> {
    if (length <= 0) return Buffer.alloc(0)
    const sftp = this.sftp
    const h = await sftpOpen(sftp, p, 'r')
    try {
      const buf = Buffer.allocUnsafe(length)
      let got = 0
      while (got < length) {
        const n = await sftpRead(sftp, h, buf, got, Math.min(READ_CHUNK, length - got), start + got)
        if (n === 0) break
        got += n
      }
      return buf.subarray(0, got)
    } finally {
      await sftpClose(sftp, h).catch(() => {})
    }
  }

  private async writeWhole(p: string, data: Buffer): Promise<void> {
    const sftp = this.sftp
    const h = await sftpOpen(sftp, p, 'w')
    try {
      await writeToHandle(sftp, h, data)
    } finally {
      await sftpClose(sftp, h).catch(() => {})
    }
  }

  async writeFileAtomic(p: string, data: Buffer): Promise<void> {
    const sftp = this.sftp
    const dir = posix.dirname(p)
    const tmp = posix.join(dir, `.${posix.basename(p)}.${randomBytes(4).toString('hex')}.cc-tmp`)
    let origMode: number | undefined
    try {
      origMode = permBits((await sftpLstat(sftp, p)).mode)
    } catch {
      /* новий файл */
    }
    try {
      await this.writeWhole(tmp, data)
      if (origMode !== undefined) await sftpChmod(sftp, tmp, origMode).catch(() => {})
      try {
        await sftpPosixRename(sftp, tmp, p)
      } catch {
        await sftpUnlink(sftp, p).catch(() => {})
        await sftpRename(sftp, tmp, p)
      }
    } catch {
      await sftpUnlink(sftp, tmp).catch(() => {})
      // Запасний варіант: запис на місці, якщо в теці немає прав на створення файлів
      await this.writeWhole(p, data)
    }
  }

  async utimes(p: string, atimeMs: number, mtimeMs: number): Promise<void> {
    await sftpUtimes(this.sftp, p, Math.floor(atimeMs / 1000), Math.floor(mtimeMs / 1000))
  }

  async diskUsage(p: string): Promise<DiskUsage | null> {
    try {
      const s = await sftpStatVfs(this.sftp, p)
      const unit = Number(s.f_frsize || s.f_bsize)
      return { total: Number(s.f_blocks) * unit, free: Number(s.f_bavail) * unit }
    } catch {
      return null
    }
  }
}
