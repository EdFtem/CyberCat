import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { sessions } from '../ssh/SessionManager'
import { parseS3Path } from '../fs/S3Fs'
import { S3Session } from './S3Session'
import { tr } from '../i18n'

/** SigV4 links are valid for at most 7 days */
const MAX_EXPIRY = 7 * 24 * 60 * 60

/** A link anyone can open to download one object, until it expires; nothing is made public */
export async function presignS3(sessionId: string, path: string, expiresIn: number): Promise<string> {
  const session = sessions.require(sessionId)
  if (!(session instanceof S3Session)) throw new Error(tr().main.s3.notSupported)
  const loc = parseS3Path(path)
  if (!loc?.key) throw new Error(tr().main.fs.isFolder)
  const expires = Math.max(60, Math.min(MAX_EXPIRY, Math.round(expiresIn)))
  return getSignedUrl(session.require(), new GetObjectCommand({ Bucket: loc.bucket, Key: loc.key }), { expiresIn: expires })
}
