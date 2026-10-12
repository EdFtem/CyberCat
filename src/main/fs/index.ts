import type { Target } from '@shared/types'
import { localFs } from './LocalFs'
import { RemoteFs } from './RemoteFs'
import { S3Fs } from './S3Fs'
import { sessions, type AnySession } from '../ssh/SessionManager'
import { S3Session } from '../s3/S3Session'
import type { FsAdapter } from './types'

/** The file system of a session: SFTP for SSH, the bucket store for S3 */
export function sessionFs(session: AnySession): FsAdapter {
  return session instanceof S3Session ? new S3Fs(session) : new RemoteFs(session)
}

export function getFs(target: Target): FsAdapter {
  if (target === 'local') return localFs
  return sessionFs(sessions.require(target))
}

export { localFs, RemoteFs, S3Fs }
export type { FsAdapter }
