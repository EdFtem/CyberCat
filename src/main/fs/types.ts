import type { DiskUsage, FileEntry } from '@shared/types'

/** Спільний інтерфейс локальної та віддаленої файлової системи */
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
  /** mkdir без помилки, якщо тека вже існує */
  ensureDir(p: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(p: string, isDir: boolean): Promise<void>
  chmod(p: string, mode: number, recursive: boolean): Promise<void>
  createFile(p: string): Promise<void>
  readFile(p: string, maxBytes?: number): Promise<{ data: Buffer; truncated: boolean }>
  writeFileAtomic(p: string, data: Buffer): Promise<void>
  utimes(p: string, atimeMs: number, mtimeMs: number): Promise<void>
  diskUsage(p: string): Promise<DiskUsage | null>
}

export function permBits(mode: number): number {
  return mode & 0o7777
}
