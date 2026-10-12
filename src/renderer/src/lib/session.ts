import type { SessionInfo } from '@shared/types'
import { tr } from './i18n'

export function isS3Session(s: Pick<SessionInfo, 'kind'> | undefined): boolean {
  return s?.kind === 's3'
}

/** Amazon S3 for AWS hosts, the endpoint host for S3-compatible services */
export function s3ServiceLabel(host: string): string {
  return !host || /(^|\.)amazonaws\.com$/i.test(host) ? tr().home.s3.service : host
}

/** How a connection is named in tabs, the status bar and dialogs */
export function sessionAddress(s: Pick<SessionInfo, 'kind' | 'username' | 'host' | 'port'>): string {
  if (s.kind === 's3') return s.username ? `${s.username} · ${s3ServiceLabel(s.host)}` : s3ServiceLabel(s.host)
  return `${s.username}@${s.host}${s.port !== 22 ? `:${s.port}` : ''}`
}

/** /bucket/a/b.txt -> s3://bucket/a/b.txt */
export function s3Uri(path: string): string {
  return `s3://${path.replace(/^\/+/, '')}`
}
