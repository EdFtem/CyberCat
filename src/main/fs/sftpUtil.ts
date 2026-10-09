import type { SFTPWrapper, Stats, FileEntryWithStats, OpenMode } from 'ssh2'

/** Промісифіковані обгортки над SFTP-клієнтом ssh2 */

export const sftpOpen = (sftp: SFTPWrapper, path: string, flags: OpenMode): Promise<Buffer> =>
  new Promise((res, rej) => sftp.open(path, flags, (e, h) => (e ? rej(e) : res(h))))

export const sftpClose = (sftp: SFTPWrapper, handle: Buffer): Promise<void> =>
  new Promise((res, rej) => sftp.close(handle, (e) => (e ? rej(e) : res())))

export const sftpRead = (
  sftp: SFTPWrapper,
  handle: Buffer,
  buf: Buffer,
  off: number,
  len: number,
  pos: number
): Promise<number> =>
  new Promise((res, rej) => sftp.read(handle, buf, off, len, pos, (e, n) => (e ? rej(e) : res(n))))

export const sftpWrite = (
  sftp: SFTPWrapper,
  handle: Buffer,
  buf: Buffer,
  off: number,
  len: number,
  pos: number
): Promise<void> =>
  new Promise((res, rej) => sftp.write(handle, buf, off, len, pos, (e) => (e ? rej(e) : res())))

export const sftpStat = (sftp: SFTPWrapper, path: string): Promise<Stats> =>
  new Promise((res, rej) => sftp.stat(path, (e, s) => (e ? rej(e) : res(s))))

export const sftpLstat = (sftp: SFTPWrapper, path: string): Promise<Stats> =>
  new Promise((res, rej) => sftp.lstat(path, (e, s) => (e ? rej(e) : res(s))))

export const sftpFstat = (sftp: SFTPWrapper, handle: Buffer): Promise<Stats> =>
  new Promise((res, rej) => sftp.fstat(handle, (e, s) => (e ? rej(e) : res(s))))

export const sftpReaddir = (sftp: SFTPWrapper, path: string): Promise<FileEntryWithStats[]> =>
  new Promise((res, rej) => sftp.readdir(path, (e, l) => (e ? rej(e) : res(l))))

export const sftpMkdir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise((res, rej) => sftp.mkdir(path, (e) => (e ? rej(e) : res())))

export const sftpRmdir = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise((res, rej) => sftp.rmdir(path, (e) => (e ? rej(e) : res())))

export const sftpUnlink = (sftp: SFTPWrapper, path: string): Promise<void> =>
  new Promise((res, rej) => sftp.unlink(path, (e) => (e ? rej(e) : res())))

export const sftpRename = (sftp: SFTPWrapper, from: string, to: string): Promise<void> =>
  new Promise((res, rej) => sftp.rename(from, to, (e) => (e ? rej(e) : res())))

export const sftpPosixRename = (sftp: SFTPWrapper, from: string, to: string): Promise<void> =>
  new Promise((res, rej) => sftp.ext_openssh_rename(from, to, (e) => (e ? rej(e) : res())))

export const sftpChmod = (sftp: SFTPWrapper, path: string, mode: number): Promise<void> =>
  new Promise((res, rej) => sftp.chmod(path, mode, (e) => (e ? rej(e) : res())))

export const sftpUtimes = (sftp: SFTPWrapper, path: string, atime: number, mtime: number): Promise<void> =>
  new Promise((res, rej) => sftp.utimes(path, atime, mtime, (e) => (e ? rej(e) : res())))

export const sftpSetstat = (sftp: SFTPWrapper, path: string, attrs: { size?: number; mode?: number }): Promise<void> =>
  new Promise((res, rej) => sftp.setstat(path, attrs, (e) => (e ? rej(e) : res())))

export const sftpReadlink = (sftp: SFTPWrapper, path: string): Promise<string> =>
  new Promise((res, rej) => sftp.readlink(path, (e, t) => (e ? rej(e) : res(t))))

export const sftpRealpath = (sftp: SFTPWrapper, path: string): Promise<string> =>
  new Promise((res, rej) => sftp.realpath(path, (e, p) => (e ? rej(e) : res(p))))

export interface StatVfs {
  f_bsize: number
  f_frsize: number
  f_blocks: number
  f_bfree: number
  f_bavail: number
}
export const sftpStatVfs = (sftp: SFTPWrapper, path: string): Promise<StatVfs> =>
  new Promise((res, rej) => sftp.ext_openssh_statvfs(path, (e, s) => (e ? rej(e) : res(s as StatVfs))))

/** Екранування для POSIX-оболонки */
export function shq(s: string): string {
  return `'${s.replace(/'/g, `'\''`)}'`
}

/** Код помилки SFTP (ssh2 додає поле code до Error) */
export function sftpCode(e: unknown): number | undefined {
  return (e as { code?: number })?.code
}

export const SFTP_NO_SUCH_FILE = 2
export const SFTP_PERMISSION_DENIED = 3
export const SFTP_FAILURE = 4
