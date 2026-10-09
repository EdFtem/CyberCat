import { promises as fsp, constants as fsConst } from 'fs'
import { randomBytes } from 'crypto'
import * as nodePath from 'path'
import { homedir } from 'os'
import type { DiskUsage, FileEntry } from '@shared/types'
import { FsAdapter, permBits } from './types'

const isWin = process.platform === 'win32'

/** Віртуальний корінь зі списком дисків у Windows */
export const DRIVES_ROOT = isWin ? '' : '/'

async function listDrives(): Promise<FileEntry[]> {
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const checks = letters.map(async (l) => {
    const root = `${l}:\\`
    try {
      const st = await fsp.stat(root)
      return {
        name: `${l}:`,
        path: root,
        isDir: true,
        isSymlink: false,
        size: 0,
        mtime: st.mtimeMs,
        mode: 0o755,
        isDrive: true
      } as FileEntry
    } catch {
      return null
    }
  })
  return (await Promise.all(checks)).filter((e): e is FileEntry => !!e)
}

export class LocalFs implements FsAdapter {
  readonly kind = 'local' as const
  readonly sep = nodePath.sep

  join(...parts: string[]): string {
    return nodePath.join(...parts)
  }
  dirname(p: string): string {
    return nodePath.dirname(p)
  }
  basename(p: string): string {
    return nodePath.basename(p)
  }

  async home(): Promise<string> {
    return homedir()
  }

  async realpath(p: string): Promise<string> {
    if (isWin && (p === '' || p === '/' || p === '\\')) return DRIVES_ROOT
    return fsp.realpath(p)
  }

  async list(p: string): Promise<FileEntry[]> {
    if (isWin && (p === '' || p === '/' || p === '\\')) return listDrives()
    const dirents = await fsp.readdir(p, { withFileTypes: true })
    const out: FileEntry[] = []
    const batch = 64
    for (let i = 0; i < dirents.length; i += batch) {
      const slice = dirents.slice(i, i + batch)
      const entries = await Promise.all(
        slice.map(async (d) => {
          const full = nodePath.join(p, d.name)
          const isSymlink = d.isSymbolicLink()
          let st
          try {
            st = await (isSymlink ? fsp.stat(full) : fsp.lstat(full))
          } catch {
            try {
              st = await fsp.lstat(full)
            } catch {
              return null
            }
          }
          let linkTarget: string | undefined
          if (isSymlink) {
            try {
              linkTarget = await fsp.readlink(full)
            } catch {
              /* ignore */
            }
          }
          return {
            name: d.name,
            path: full,
            isDir: st.isDirectory(),
            isSymlink,
            size: st.isDirectory() ? 0 : st.size,
            mtime: st.mtimeMs,
            mode: permBits(st.mode),
            linkTarget
          } as FileEntry
        })
      )
      for (const e of entries) if (e) out.push(e)
    }
    return out
  }

  async stat(p: string): Promise<FileEntry> {
    const lst = await fsp.lstat(p)
    const isSymlink = lst.isSymbolicLink()
    const st = isSymlink ? await fsp.stat(p).catch(() => lst) : lst
    return {
      name: nodePath.basename(p) || p,
      path: p,
      isDir: st.isDirectory(),
      isSymlink,
      size: st.isDirectory() ? 0 : st.size,
      mtime: st.mtimeMs,
      mode: permBits(st.mode)
    }
  }

  async mkdir(p: string): Promise<void> {
    await fsp.mkdir(p)
  }

  async ensureDir(p: string): Promise<void> {
    await fsp.mkdir(p, { recursive: true })
  }

  async rename(from: string, to: string): Promise<void> {
    try {
      await fsp.access(to, fsConst.F_OK)
      throw new Error(`Файл або тека вже існує: ${to}`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
    await fsp.rename(from, to)
  }

  async copy(src: string, dest: string): Promise<void> {
    try {
      await fsp.access(dest, fsConst.F_OK)
      throw new Error(`Файл або тека вже існує: ${dest}`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
    await fsp.cp(src, dest, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true })
  }

  async remove(p: string, isDir: boolean): Promise<void> {
    if (isDir) await fsp.rm(p, { recursive: true, force: false, maxRetries: 2 })
    else await fsp.unlink(p)
  }

  async rmdir(p: string): Promise<void> {
    await fsp.rmdir(p)
  }

  async chmod(p: string, mode: number, recursive: boolean): Promise<void> {
    await fsp.chmod(p, mode)
    if (!recursive) return
    const st = await fsp.lstat(p)
    if (!st.isDirectory()) return
    const items = await fsp.readdir(p, { withFileTypes: true })
    for (const d of items) {
      if (d.isSymbolicLink()) continue
      await this.chmod(nodePath.join(p, d.name), mode, true)
    }
  }

  async createFile(p: string): Promise<void> {
    const fh = await fsp.open(p, 'wx')
    await fh.close()
  }

  async readFile(p: string, maxBytes = Infinity): Promise<{ data: Buffer; truncated: boolean }> {
    const fh = await fsp.open(p, 'r')
    try {
      const st = await fh.stat()
      const len = Math.min(st.size, maxBytes)
      const buf = Buffer.allocUnsafe(len)
      let got = 0
      while (got < len) {
        const { bytesRead } = await fh.read(buf, got, len - got, got)
        if (bytesRead === 0) break
        got += bytesRead
      }
      return { data: got === len ? buf : buf.subarray(0, got), truncated: st.size > len }
    } finally {
      await fh.close()
    }
  }

  async readRange(p: string, start: number, length: number): Promise<Buffer> {
    if (length <= 0) return Buffer.alloc(0)
    const fh = await fsp.open(p, 'r')
    try {
      const buf = Buffer.allocUnsafe(length)
      let got = 0
      while (got < length) {
        const { bytesRead } = await fh.read(buf, got, length - got, start + got)
        if (bytesRead === 0) break
        got += bytesRead
      }
      return buf.subarray(0, got)
    } finally {
      await fh.close()
    }
  }

  async writeFileAtomic(p: string, data: Buffer): Promise<void> {
    const dir = nodePath.dirname(p)
    const tmp = nodePath.join(dir, `.${nodePath.basename(p)}.${randomBytes(4).toString('hex')}.cc-tmp`)
    try {
      await fsp.writeFile(tmp, data)
      await fsp.rename(tmp, p)
    } catch (e) {
      await fsp.unlink(tmp).catch(() => {})
      // Запасний варіант: запис на місці (наприклад, немає прав на створення файлів у теці)
      await fsp.writeFile(p, data)
    }
  }

  async utimes(p: string, atimeMs: number, mtimeMs: number): Promise<void> {
    await fsp.utimes(p, atimeMs / 1000, mtimeMs / 1000)
  }

  async diskUsage(p: string): Promise<DiskUsage | null> {
    try {
      const st = await fsp.statfs(p)
      return { total: Number(st.blocks) * Number(st.bsize), free: Number(st.bavail) * Number(st.bsize) }
    } catch {
      return null
    }
  }
}

export const localFs = new LocalFs()
