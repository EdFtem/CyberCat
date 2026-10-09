import type { DiskUsage, FileEntry } from '@shared/types'

/** Common interface of the local and remote file systems */
export interface FsAdapter {
  readonly kind: 'local' | 'remote'
  readonly sep: string
  join(...parts: string[]): string
  dirname(p: string): string
  basename(p: string): string

  home(): Promise<string>
  realpath(p: string): Promise<string>
  list(p: string): Promise<FileEntry[]>
  stat(p: string): Promise<FileEntry>
  mkdir(p: string): Promise<void>
  /** mkdir that does not fail if the folder already exists */
  ensureDir(p: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  /** Copy within the same file system (folders recursively) */
  copy(src: string, dest: string): Promise<void>
  remove(p: string, isDir: boolean): Promise<void>
  /** Remove an empty folder only */
  rmdir(p: string): Promise<void>
  chmod(p: string, mode: number, recursive: boolean): Promise<void>
  createFile(p: string): Promise<void>
  readFile(p: string, maxBytes?: number): Promise<{ data: Buffer; truncated: boolean }>
  /** Read length bytes of the file starting at start */
  readRange(p: string, start: number, length: number): Promise<Buffer>
  writeFileAtomic(p: string, data: Buffer): Promise<void>
  utimes(p: string, atimeMs: number, mtimeMs: number): Promise<void>
  diskUsage(p: string): Promise<DiskUsage | null>
}

export function permBits(mode: number): number {
  return mode & 0o7777
}
