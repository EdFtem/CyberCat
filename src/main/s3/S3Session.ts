import { EventEmitter } from 'events'
import { HeadBucketCommand, ListBucketsCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import { prompt } from '../prompter'
import { profiles } from '../store/profiles'
import { tr } from '../i18n'
import { awsProfileRegion } from './awsConfig'
import type { PasswordAnswer, Profile, S3Settings, SessionInfo, SessionStatus } from '@shared/types'

const MAX_SECRET_ATTEMPTS = 3

/** HTTP status and S3 error code of an SDK error */
export function s3ErrorInfo(e: unknown): { status?: number; code: string; message: string } {
  const err = e as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return { status: err?.$metadata?.httpStatusCode, code: err?.Code || err?.name || '', message: err?.message || String(e) }
}

export function isS3NotFound(e: unknown): boolean {
  const { status, code } = s3ErrorInfo(e)
  return status === 404 || code === 'NotFound' || code === 'NoSuchKey'
}

function isAuthError(e: unknown): boolean {
  const { code } = s3ErrorInfo(e)
  return code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch' || code === 'InvalidClientTokenId'
}

/** Short, actionable messages for the errors people actually hit */
export function humanizeS3Error(e: unknown, context: { host: string; profile?: string; bucket?: string }): string {
  const { status, code, message } = s3ErrorInfo(e)
  const t = tr().main.s3
  if (isAuthError(e)) return t.authFailed
  if (code === 'ExpiredToken' || code === 'TokenRefreshRequired') return t.expiredToken
  if (context.profile && /sso|token/i.test(code + message) && /expired|refresh|invalid/i.test(message)) return t.ssoExpired(context.profile)
  if (code === 'CredentialsProviderError' && context.profile) return t.profileFailed(context.profile, message)
  if (code === 'NoSuchBucket' || (status === 404 && context.bucket)) return t.noSuchBucket(context.bucket ?? '')
  if (code === 'AccessDenied' || code === 'Forbidden' || status === 403) return t.accessDenied(context.bucket ?? message)
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|socket hang up/i.test(code + message)) return t.unreachable(context.host)
  return message
}

function defaultName(profile: Profile): string {
  const s = profile.s3
  if (s?.bucket) return `s3://${s.bucket}`
  return profile.host || 'S3'
}

/** One S3 account or S3-compatible service. Stateless HTTP, so there is nothing to keep alive or reconnect. */
export class S3Session extends EventEmitter {
  info: SessionInfo
  client?: S3Client
  region = 'us-east-1'
  private ready = false
  private secret?: string

  constructor(
    public readonly id: string,
    public profile: Profile
  ) {
    super()
    this.info = {
      id,
      kind: 's3',
      profileId: profile.id || undefined,
      name: profile.name || defaultName(profile),
      host: profile.host,
      port: profile.port,
      username: profile.username,
      status: 'connecting',
      hasShell: false,
      sudo: false,
      color: profile.color,
      startRemotePath: profile.remotePath,
      startLocalPath: profile.localPath
    }
  }

  get settings(): S3Settings {
    return this.profile.s3 ?? { auth: 'keys' }
  }

  get isConnected(): boolean {
    return this.ready && !!this.client
  }

  /** Bucket opened at connect, if the profile names one */
  get bucket(): string | undefined {
    return this.settings.bucket?.trim().replace(/^\/+|\/+$/g, '') || undefined
  }

  private setStatus(status: SessionStatus, error?: string): void {
    this.info = { ...this.info, status, error }
    this.emit('update', this.info)
  }

  private makeClient(credentials: NonNullable<S3ClientConfig['credentials']>): S3Client {
    const s = this.settings
    const endpoint = s.endpoint?.trim() || undefined
    return new S3Client({
      region: this.region,
      credentials,
      endpoint,
      forcePathStyle: s.pathStyle ?? !!endpoint,
      // Buckets live in different regions; the SDK retries against the right one
      followRegionRedirects: true,
      maxAttempts: 3,
      // Default CRC32 checksums are not understood by every S3-compatible service
      ...(endpoint ? { requestChecksumCalculation: 'WHEN_REQUIRED' as const, responseChecksumValidation: 'WHEN_REQUIRED' as const } : {})
    })
  }

  /** A cheap request that proves the credentials work: the bucket if one is set, otherwise the bucket list */
  private async check(client: S3Client): Promise<void> {
    if (this.bucket) {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return
    }
    try {
      await client.send(new ListBucketsCommand({}))
    } catch (e) {
      const { code, status } = s3ErrorInfo(e)
      if (code === 'AccessDenied' || status === 403) throw new Error(tr().main.s3.cannotListBuckets)
      throw e
    }
  }

  async connect(password?: string): Promise<void> {
    this.ready = false
    this.client?.destroy()
    this.client = undefined
    this.setStatus('connecting')
    const s = this.settings
    const context = { host: this.info.host, profile: s.auth === 'profile' ? s.awsProfile?.trim() || 'default' : undefined, bucket: this.bucket }
    try {
      this.region = s.region?.trim() || (s.auth === 'profile' ? await awsProfileRegion(context.profile) : undefined) || 'us-east-1'
      if (s.auth === 'profile') {
        // fromIni covers static keys, SSO, credential_process and assumed roles of ~/.aws profiles
        const client = this.makeClient(fromIni({ profile: context.profile, ignoreCache: true }))
        try {
          await this.check(client)
        } catch (e) {
          client.destroy()
          throw e
        }
        this.client = client
      } else {
        await this.connectWithKeys(password)
      }
      this.ready = true
      this.info = { ...this.info, homeDir: this.bucket ? `/${this.bucket}` : '/' }
      this.setStatus('connected')
    } catch (e) {
      // SDK errors get a readable message; our own errors pass through unchanged
      const message = humanizeS3Error(e, context)
      this.setStatus('error', message)
      throw new Error(message)
    }
  }

  private async connectWithKeys(password?: string): Promise<void> {
    const keyId = this.settings.accessKeyId?.trim()
    if (!keyId) throw new Error(tr().main.s3.noAccessKey)
    let secret = password || this.secret || profiles.getPassword(this.profile.id)
    for (let attempt = 0; attempt < MAX_SECRET_ATTEMPTS; attempt++) {
      if (!secret) {
        const a = await prompt<PasswordAnswer>('password', {
          host: this.info.host,
          username: keyId,
          canSave: !!this.profile.id,
          purpose: 's3',
          reason: attempt ? tr().main.s3.wrongSecretRetry : tr().main.s3.secretPrompt(keyId),
          retry: attempt > 0
        })
        if (a.password == null) throw new Error(tr().main.ssh.connectCancelled)
        secret = a.password
        if (a.save && this.profile.id) {
          profiles.setPassword(this.profile.id, secret)
          this.profile = { ...this.profile, savePassword: true }
        }
      }
      const client = this.makeClient({ accessKeyId: keyId, secretAccessKey: secret })
      try {
        await this.check(client)
        this.client = client
        this.secret = secret
        return
      } catch (e) {
        client.destroy()
        if (!isAuthError(e) || attempt === MAX_SECRET_ATTEMPTS - 1) throw e
        // A saved secret that no longer works is not tried again
        if (this.profile.id && profiles.getPassword(this.profile.id) === secret) profiles.clearPassword(this.profile.id)
        secret = undefined
      }
    }
  }

  /** The connected client; throws like an SSH session that lost its connection */
  require(): S3Client {
    if (!this.ready || !this.client) throw new Error(tr().main.session.notConnected)
    return this.client
  }

  disconnect(): void {
    this.ready = false
    this.client?.destroy()
    this.client = undefined
    this.setStatus('disconnected')
  }
}
