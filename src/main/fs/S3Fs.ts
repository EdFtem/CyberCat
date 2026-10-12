import { posix } from 'path'
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type HeadObjectCommandOutput,
  type S3Client
} from '@aws-sdk/client-s3'
import type { DiskUsage, FileEntry } from '@shared/types'
import type { S3Session } from '../s3/S3Session'
import { isS3NotFound, s3ErrorInfo } from '../s3/S3Session'
import { contentTypeFor } from '../s3/mime'
import { tr } from '../i18n'
import type { FsAdapter } from './types'

/** Folders deeper than this many objects stop listing; the rest stays reachable by path or search */
const LIST_LIMIT = 50_000
/** DeleteObjects accepts at most 1000 keys per request */
const DELETE_BATCH = 1000
/** CopyObject handles objects up to 5 GB in one request */
const MAX_SINGLE_COPY = 5 * 1024 ** 3
const COPY_CONCURRENCY = 8

export interface S3Location {
  bucket: string
  /** Object key without a leading slash; empty for the bucket itself */
  key: string
}

/** /bucket/a/b.txt -> { bucket, key: 'a/b.txt' }; / -> null */
export function parseS3Path(p: string): S3Location | null {
  const parts = posix.normalize(p || '/').split('/').filter(Boolean)
  if (!parts.length) return null
  return { bucket: parts[0], key: parts.slice(1).join('/') }
}

/** CopySource must be URL-encoded but keep its slashes */
function copySource(loc: S3Location): string {
  return `${loc.bucket}/${encodeURIComponent(loc.key).replace(/%2F/g, '/')}`
}

/** S3 has no metadata-only listing of a folder; folders are key prefixes, and an empty folder is a "name/" marker object */
export class S3Fs implements FsAdapter {
  readonly kind = 'remote' as const
  readonly sep = '/'

  constructor(private session: S3Session) {}

  private get client(): S3Client {
    return this.session.require()
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
    return this.session.info.homeDir ?? '/'
  }

  async realpath(p: string): Promise<string> {
    return posix.normalize(p || '/')
  }

  private notFound(p: string): Error {
    const e = new Error(tr().main.s3.notFound(p)) as Error & { code: string }
    e.code = 'ENOENT'
    return e
  }

  private dirEntry(path: string, mtime = 0): FileEntry {
    return { name: posix.basename(path), path, isDir: true, isSymlink: false, size: 0, mtime, mode: 0 }
  }

  /** Throws a readable error for a missing bucket instead of the SDK's bare 404 */
  private async send<T>(fn: () => Promise<T>, bucket: string): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      const { code } = s3ErrorInfo(e)
      if (code === 'NoSuchBucket') throw new Error(tr().main.s3.noSuchBucket(bucket))
      if (code === 'AccessDenied') throw new Error(tr().main.s3.accessDenied(bucket))
      throw e
    }
  }

  async list(p: string): Promise<FileEntry[]> {
    const loc = parseS3Path(p)
    if (!loc) {
      try {
        const r = await this.client.send(new ListBucketsCommand({}))
        return (r.Buckets ?? []).filter((b) => b.Name).map((b) => this.dirEntry(`/${b.Name}`, b.CreationDate?.getTime() ?? 0))
      } catch (e) {
        const { code, status } = s3ErrorInfo(e)
        if (code === 'AccessDenied' || status === 403) throw new Error(tr().main.s3.cannotListBuckets)
        throw e
      }
    }
    const prefix = loc.key ? `${loc.key}/` : ''
    const base = `/${loc.bucket}${loc.key ? `/${loc.key}` : ''}`
    const entries: FileEntry[] = []
    let token: string | undefined
    do {
      const r = await this.send(
        () => this.client.send(new ListObjectsV2Command({ Bucket: loc.bucket, Prefix: prefix, Delimiter: '/', ContinuationToken: token })),
        loc.bucket
      )
      for (const cp of r.CommonPrefixes ?? []) {
        const name = cp.Prefix?.slice(prefix.length).replace(/\/$/, '')
        if (name) entries.push(this.dirEntry(`${base}/${name}`))
      }
      for (const o of r.Contents ?? []) {
        const name = o.Key?.slice(prefix.length)
        // The folder's own marker object, and keys with empty segments, are not files
        if (!name || name.includes('/')) continue
        entries.push({
          name,
          path: `${base}/${name}`,
          isDir: false,
          isSymlink: false,
          size: o.Size ?? 0,
          mtime: o.LastModified?.getTime() ?? 0,
          mode: 0,
          etag: o.ETag?.replace(/"/g, '')
        })
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined
    } while (token && entries.length < LIST_LIMIT)
    return entries
  }

  private async head(loc: S3Location): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.client.send(new HeadObjectCommand({ Bucket: loc.bucket, Key: loc.key }))
    } catch (e) {
      if (isS3NotFound(e)) return null
      throw e
    }
  }

  /** Whether any object lives under key/ (a folder, possibly just its marker) */
  private async hasPrefix(loc: S3Location): Promise<boolean> {
    const r = await this.send(
      () => this.client.send(new ListObjectsV2Command({ Bucket: loc.bucket, Prefix: loc.key ? `${loc.key}/` : '', MaxKeys: 1 })),
      loc.bucket
    )
    return (r.KeyCount ?? r.Contents?.length ?? 0) > 0
  }

  async stat(p: string): Promise<FileEntry> {
    const path = posix.normalize(p || '/')
    const loc = parseS3Path(path)
    if (!loc) return { ...this.dirEntry('/'), name: '/' }
    if (!loc.key) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: loc.bucket }))
      } catch (e) {
        if (isS3NotFound(e)) throw this.notFound(path)
        throw e
      }
      return this.dirEntry(path)
    }
    const h = await this.head(loc)
    if (h) {
      return {
        name: posix.basename(path),
        path,
        isDir: false,
        isSymlink: false,
        size: h.ContentLength ?? 0,
        mtime: h.LastModified?.getTime() ?? 0,
        mode: 0
      }
    }
    if (await this.hasPrefix(loc)) return this.dirEntry(path)
    throw this.notFound(path)
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await this.stat(p)
      return true
    } catch (e) {
      if ((e as { code?: string }).code === 'ENOENT') return false
      throw e
    }
  }

  async mkdir(p: string): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc) throw new Error(tr().main.fs.alreadyExists('/'))
    if (await this.exists(p)) throw new Error(tr().main.fs.alreadyExists(p))
    if (!loc.key) {
      // A "folder" at the top level is a bucket, created in the session's region
      const region = this.session.region
      const custom = !!this.session.settings.endpoint
      await this.client.send(
        new CreateBucketCommand({
          Bucket: loc.bucket,
          ...(custom || region === 'us-east-1' ? {} : { CreateBucketConfiguration: { LocationConstraint: region as never } })
        })
      )
      return
    }
    await this.send(() => this.client.send(new PutObjectCommand({ Bucket: loc.bucket, Key: `${loc.key}/`, Body: '', ContentLength: 0 })), loc.bucket)
  }

  /** Folders exist implicitly once they hold an object, so only the bucket has to exist */
  async ensureDir(p: string): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc) return
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: loc.bucket }))
    } catch (e) {
      if (isS3NotFound(e)) throw new Error(tr().main.s3.noSuchBucket(loc.bucket))
      throw e
    }
  }

  /** Every key under a folder, including its marker */
  private async listAll(loc: S3Location): Promise<{ key: string; size: number }[]> {
    const prefix = loc.key ? `${loc.key}/` : ''
    const out: { key: string; size: number }[] = []
    let token: string | undefined
    do {
      const r = await this.send(
        () => this.client.send(new ListObjectsV2Command({ Bucket: loc.bucket, Prefix: prefix, ContinuationToken: token })),
        loc.bucket
      )
      for (const o of r.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0 })
      token = r.IsTruncated ? r.NextContinuationToken : undefined
    } while (token)
    return out
  }

  private async copyObject(from: S3Location, to: S3Location, size: number): Promise<void> {
    if (size > MAX_SINGLE_COPY) throw new Error(tr().main.s3.copyTooLarge(posix.basename(from.key)))
    await this.client.send(new CopyObjectCommand({ Bucket: to.bucket, Key: to.key, CopySource: copySource(from) }))
  }

  /** Copies a file or a whole folder; returns the source keys that were copied */
  private async copyTree(src: string, dest: string): Promise<{ bucket: string; keys: string[] }> {
    const from = parseS3Path(src)
    const to = parseS3Path(dest)
    if (!from?.key || !to?.key) throw new Error(tr().main.s3.notSupported)
    if (await this.exists(dest)) throw new Error(tr().main.fs.alreadyExists(dest))
    const st = await this.stat(src)
    if (!st.isDir) {
      await this.copyObject(from, to, st.size)
      return { bucket: from.bucket, keys: [from.key] }
    }
    const objects = await this.listAll(from)
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < objects.length) {
        const o = objects[next++]
        const rel = o.key.slice(from.key.length + 1)
        await this.copyObject({ bucket: from.bucket, key: o.key }, { bucket: to.bucket, key: `${to.key}/${rel}` }, o.size)
      }
    }
    await Promise.all(Array.from({ length: Math.min(COPY_CONCURRENCY, objects.length) }, worker))
    return { bucket: from.bucket, keys: objects.map((o) => o.key) }
  }

  private async deleteKeys(bucket: string, keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH)
      const r = await this.client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }))
      const failed = r.Errors?.[0]
      if (failed) throw new Error(`${failed.Key}: ${failed.Message ?? failed.Code}`)
    }
  }

  /** S3 has no rename: copy, then delete the originals */
  async rename(from: string, to: string): Promise<void> {
    const { bucket, keys } = await this.copyTree(from, to)
    await this.deleteKeys(bucket, keys)
  }

  async copy(src: string, dest: string): Promise<void> {
    await this.copyTree(src, dest)
  }

  async remove(p: string, isDir: boolean): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc) return
    if (!loc.key) {
      // Buckets are only deleted when empty: S3 refuses otherwise, and emptying one is too big a side effect of a click
      try {
        await this.client.send(new DeleteBucketCommand({ Bucket: loc.bucket }))
      } catch (e) {
        if (s3ErrorInfo(e).code === 'BucketNotEmpty') throw new Error(tr().main.s3.bucketNotEmpty(loc.bucket))
        throw e
      }
      return
    }
    if (isDir) {
      const objects = await this.listAll(loc)
      await this.deleteKeys(loc.bucket, objects.map((o) => o.key))
      return
    }
    await this.send(() => this.client.send(new DeleteObjectCommand({ Bucket: loc.bucket, Key: loc.key })), loc.bucket)
  }

  /** Removes a folder marker once nothing else is left under it */
  async rmdir(p: string): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc?.key) return
    const r = await this.client.send(new ListObjectsV2Command({ Bucket: loc.bucket, Prefix: `${loc.key}/`, MaxKeys: 2 }))
    const keys = (r.Contents ?? []).map((o) => o.Key)
    if (keys.length === 1 && keys[0] === `${loc.key}/`) {
      await this.client.send(new DeleteObjectCommand({ Bucket: loc.bucket, Key: `${loc.key}/` }))
    } else if (keys.length) {
      throw new Error('ENOTEMPTY')
    }
  }

  async chmod(): Promise<void> {
    throw new Error(tr().main.s3.noPermissions)
  }

  async createFile(p: string): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc?.key) throw new Error(tr().main.s3.notSupported)
    if (await this.exists(p)) throw new Error(tr().main.fs.alreadyExists(p))
    await this.send(
      () => this.client.send(new PutObjectCommand({ Bucket: loc.bucket, Key: loc.key, Body: '', ContentLength: 0, ContentType: contentTypeFor(loc.key) })),
      loc.bucket
    )
  }

  private async getRange(loc: S3Location, start: number, end?: number): Promise<Buffer> {
    try {
      const r = await this.client.send(
        new GetObjectCommand({ Bucket: loc.bucket, Key: loc.key, Range: end === undefined ? `bytes=${start}-` : `bytes=${start}-${end}` })
      )
      return Buffer.from((await r.Body?.transformToByteArray()) ?? new Uint8Array())
    } catch (e) {
      if (isS3NotFound(e)) throw this.notFound(`/${loc.bucket}/${loc.key}`)
      throw e
    }
  }

  async readFile(p: string, maxBytes?: number): Promise<{ data: Buffer; truncated: boolean }> {
    const loc = parseS3Path(p)
    if (!loc?.key) throw new Error(tr().main.fs.isFolder)
    const h = await this.head(loc)
    if (!h) throw this.notFound(p)
    const size = h.ContentLength ?? 0
    if (size === 0) return { data: Buffer.alloc(0), truncated: false }
    const limit = maxBytes !== undefined && size > maxBytes ? maxBytes : size
    return { data: await this.getRange(loc, 0, limit - 1), truncated: limit < size }
  }

  async readRange(p: string, start: number, length: number): Promise<Buffer> {
    const loc = parseS3Path(p)
    if (!loc?.key) throw new Error(tr().main.fs.isFolder)
    if (length <= 0) return Buffer.alloc(0)
    try {
      return await this.getRange(loc, start, start + length - 1)
    } catch (e) {
      // Asking past the end of an object is not an error for a file system (AWS says InvalidRange, others only send 416)
      const { code, status } = s3ErrorInfo(e)
      if (code === 'InvalidRange' || status === 416) return Buffer.alloc(0)
      throw e
    }
  }

  /** A PUT replaces the whole object at once, so writes are atomic. Editing keeps the object's type, caching and metadata. */
  async writeFileAtomic(p: string, data: Buffer): Promise<void> {
    const loc = parseS3Path(p)
    if (!loc?.key) throw new Error(tr().main.fs.isFolder)
    const h = await this.head(loc)
    await this.send(
      () =>
        this.client.send(
          new PutObjectCommand({
            Bucket: loc.bucket,
            Key: loc.key,
            Body: data,
            ContentLength: data.length,
            ContentType: h?.ContentType ?? contentTypeFor(loc.key),
            CacheControl: h?.CacheControl,
            ContentEncoding: h?.ContentEncoding,
            ContentDisposition: h?.ContentDisposition,
            ContentLanguage: h?.ContentLanguage,
            Metadata: h?.Metadata,
            StorageClass: h?.StorageClass as never
          })
        ),
      loc.bucket
    )
  }

  /** S3 sets LastModified itself */
  async utimes(): Promise<void> {}

  async diskUsage(): Promise<DiskUsage | null> {
    return null
  }
}
