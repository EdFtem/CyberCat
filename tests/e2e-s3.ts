/**
 * S3 E2E test: runs inside Electron (no window) against any S3 API. By default a local S3Mock:
 *   docker run -d --name cybercat-s3 -p 9090:9090 -e COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=cybercat-test adobe/s3mock:4.7.0
 *   npm run test:e2e:s3
 * CC_S3_ENDPOINT, CC_S3_BUCKET, CC_S3_KEY_ID, CC_S3_SECRET and CC_S3_REGION point it at another service;
 * leave CC_S3_ENDPOINT empty to use Amazon S3 itself.
 */
import { app } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { promises as fsp } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import http from 'http'
import https from 'https'

const ENDPOINT = process.env.CC_S3_ENDPOINT ?? 'http://127.0.0.1:9090'
const BUCKET = process.env.CC_S3_BUCKET ?? 'cybercat-test'
const KEY_ID = process.env.CC_S3_KEY_ID ?? 'test'
const SECRET = process.env.CC_S3_SECRET ?? 'test-secret'
const REGION = process.env.CC_S3_REGION ?? 'us-east-1'

let failures = 0
let passes = 0
function ok(cond: unknown, msg: string): void {
  if (cond) {
    passes++
    console.log(`  ✓ ${msg}`)
  } else {
    failures++
    console.log(`  ✗ ${msg}`)
  }
}
function eq<T>(a: T, b: T, msg: string): void {
  ok(a === b, `${msg} (${String(a)} === ${String(b)})`)
}
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
async function until(fn: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`)
    await wait(50)
  }
}
function httpGet(url: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    ;(url.startsWith('https') ? https : http)
      .get(url, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }))
      })
      .on('error', reject)
  })
}

async function main(): Promise<void> {
  const userData = await fsp.mkdtemp(join(tmpdir(), 'cybercat-s3-test-'))
  app.setPath('userData', userData)
  await app.whenReady()

  const { sessions } = await import('../src/main/ssh/SessionManager')
  const { getFs } = await import('../src/main/fs')
  const { transfers } = await import('../src/main/transfer/TransferManager')
  const { openText, saveText } = await import('../src/main/editor/TextEditor')
  const { runCompare } = await import('../src/main/sync/CompareService')
  const { runSearch } = await import('../src/main/search/SearchService')
  const { presignS3 } = await import('../src/main/s3/presign')
  const { S3Session } = await import('../src/main/s3/S3Session')
  const { ListMultipartUploadsCommand } = await import('@aws-sdk/client-s3')

  console.log(`\n[1] Connect to ${ENDPOINT || 'Amazon S3'}`)
  const host = ENDPOINT ? new URL(ENDPOINT).host : `s3.${REGION}.amazonaws.com`
  const info = await sessions.connect({
    adHoc: {
      kind: 's3',
      name: 'S3 test',
      host,
      port: 443,
      username: KEY_ID,
      auth: 'password',
      savePassword: false,
      s3: { auth: 'keys', accessKeyId: KEY_ID, region: REGION, endpoint: ENDPOINT || undefined, bucket: BUCKET }
    },
    password: SECRET
  })
  eq(info.status, 'connected', 'status connected')
  eq(info.kind, 's3', 'session kind s3')
  eq(info.homeDir, `/${BUCKET}`, 'home is the bucket')
  ok(!info.hasShell, 'no shell for S3')
  const fs = getFs(info.id)
  const session = sessions.require(info.id) as InstanceType<typeof S3Session>

  const wrong = await sessions
    .connect({
      adHoc: {
        kind: 's3',
        name: 'wrong',
        host,
        port: 443,
        username: 'nobody',
        auth: 'password',
        savePassword: false,
        s3: { auth: 'keys', accessKeyId: 'nobody', region: REGION, endpoint: ENDPOINT || undefined, bucket: `${BUCKET}-missing-${Date.now()}` }
      },
      password: 'x'
    })
    .then(() => null, (e: Error) => e.message)
  ok(!!wrong, `a missing bucket fails with a readable message: ${wrong}`)

  console.log('\n[2] Browse and files')
  const root = await fs.list('/').catch((e: Error) => e)
  ok(Array.isArray(root) ? root.some((e) => e.name === BUCKET && e.isDir) : /list buckets/i.test(String(root)), 'bucket list at / (or a clear message without permission)')
  const base = `/${BUCKET}/cc-test-${Date.now()}`
  await fs.mkdir(base)
  const st = await fs.stat(base)
  ok(st.isDir, 'mkdir creates a folder')
  let threw = false
  await fs.mkdir(base).catch(() => (threw = true))
  ok(threw, 'mkdir refuses an existing folder')
  await fs.mkdir(`${base}/empty`)
  await fs.createFile(`${base}/new.txt`)
  await fs.writeFileAtomic(`${base}/hello.txt`, Buffer.from('привіт\nсвіт\n', 'utf8'))
  const list = await fs.list(base)
  eq(list.map((e) => `${e.name}${e.isDir ? '/' : ''}`).sort().join(','), 'empty/,hello.txt,new.txt', 'listing shows folders and files, not the folder marker')
  eq((await fs.readFile(`${base}/hello.txt`)).data.toString('utf8'), 'привіт\nсвіт\n', 'readFile after write')
  eq((await fs.readRange(`${base}/hello.txt`, 0, 12)).toString('utf8'), 'привіт', 'readRange (12 bytes of UTF-8)')
  eq((await fs.readRange(`${base}/hello.txt`, 999, 10)).length, 0, 'readRange past the end is empty')
  eq((await fs.readFile(`${base}/hello.txt`, 4)).truncated, true, 'readFile with a limit reports truncation')
  eq((await fs.list(`${base}/empty`)).length, 0, 'an empty folder lists nothing')

  console.log('\n[3] Editor: content type kept, conflict detection')
  const doc = await openText(info.id, `${base}/hello.txt`)
  eq(doc.encoding, 'utf-8', 'utf-8 detected')
  await wait(1100)
  await fs.writeFileAtomic(`${base}/hello.txt`, Buffer.from('changed elsewhere\n'))
  const conflict = await saveText({ target: info.id, path: `${base}/hello.txt`, content: 'mine', eol: 'LF', encoding: 'utf-8', expectedMtime: doc.mtime })
  ok(!conflict.ok && conflict.conflict, 'a change on the server is detected')
  const forced = await saveText({ target: info.id, path: `${base}/hello.txt`, content: 'mine\n', eol: 'LF', encoding: 'utf-8', force: true })
  ok(forced.ok, 'forced save')

  console.log('\n[4] Rename, copy, remove')
  await fs.rename(`${base}/new.txt`, `${base}/renamed.txt`)
  ok(!(await fs.list(base)).some((e) => e.name === 'new.txt'), 'rename removes the old key')
  await fs.writeFileAtomic(`${base}/tree/a/one.txt`, Buffer.from('1'))
  await fs.writeFileAtomic(`${base}/tree/b/two.txt`, Buffer.from('22'))
  await fs.copy(`${base}/tree`, `${base}/tree-copy`)
  eq((await fs.readFile(`${base}/tree-copy/b/two.txt`)).data.toString(), '22', 'folder copy keeps nested keys')
  await fs.rename(`${base}/tree-copy`, `${base}/tree-moved`)
  ok((await fs.list(base)).some((e) => e.name === 'tree-moved') && !(await fs.list(base)).some((e) => e.name === 'tree-copy'), 'folder rename')
  await fs.remove(`${base}/tree-moved`, true)
  ok(!(await fs.list(base)).some((e) => e.name === 'tree-moved'), 'recursive remove')
  threw = false
  await fs.chmod(`${base}/renamed.txt`, 0o644, false).catch(() => (threw = true))
  ok(threw, 'chmod is refused with a message')

  console.log('\n[5] Transfers: multipart upload, download, hashes')
  const localSrc = await fsp.mkdtemp(join(tmpdir(), 'cc-s3-src-'))
  const localDst = await fsp.mkdtemp(join(tmpdir(), 'cc-s3-dst-'))
  const big = randomBytes(40 * 1024 * 1024 + 12345)
  await fsp.mkdir(join(localSrc, 'up', 'nested'), { recursive: true })
  await fsp.writeFile(join(localSrc, 'up', 'big.bin'), big)
  await fsp.writeFile(join(localSrc, 'up', 'nested', 'small.txt'), 'small')
  await fsp.writeFile(join(localSrc, 'up', 'nested', 'zero.bin'), '')
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'up'), name: 'up', isDir: true }], destDir: base, policy: 'overwrite' })
  const uploads = () => transfers.summary().items.filter((i) => i.sessionId === info.id)
  await until(() => uploads().length === 3 && uploads().every((i) => ['done', 'error', 'cancelled'].includes(i.status)), 180_000, 'upload done')
  ok(uploads().every((i) => i.status === 'done'), `uploads done: ${uploads().map((i) => `${i.name}:${i.status}${i.error ? `(${i.error})` : ''}`).join(', ')}`)
  eq((await fs.stat(`${base}/up/big.bin`)).size, big.length, 'multipart object has the full size')
  eq((await fs.stat(`${base}/up/nested/zero.bin`)).size, 0, 'empty file uploaded')
  const ct = (await session.require().send(new (await import('@aws-sdk/client-s3')).HeadObjectCommand({ Bucket: BUCKET, Key: `${base.slice(BUCKET.length + 2)}/up/nested/small.txt` }))).ContentType
  ok(/^text\/plain/.test(ct ?? ''), `content type set from the extension (${ct})`)

  transfers.clearFinished()
  await transfers.enqueue({ sessionId: info.id, direction: 'download', sources: [{ path: `${base}/up`, name: 'up', isDir: true }], destDir: localDst, policy: 'overwrite' })
  await until(() => uploads().length === 3 && uploads().every((i) => ['done', 'error', 'cancelled'].includes(i.status)), 180_000, 'download done')
  ok(uploads().every((i) => i.status === 'done'), `downloads done: ${uploads().map((i) => i.status).join(',')}`)
  eq(sha256(await fsp.readFile(join(localDst, 'up', 'big.bin'))), sha256(big), 'sha256 of the downloaded file')
  eq((await fsp.readFile(join(localDst, 'up', 'nested', 'small.txt'))).toString(), 'small', 'nested small file')

  console.log('\n[6] Pause, resume, cancel')
  // A local server finishes 64 MB before the test can look; slow each transfer request so pause and cancel land mid-way
  session.require().middlewareStack.add(
    (next, context) => async (args) => {
      if (/UploadPart|GetObject/.test(context.commandName ?? '')) await wait(250)
      return next(args)
    },
    { step: 'build', name: 'testThrottle' }
  )
  transfers.clearFinished()
  // 16 parts: with 4 in flight, a pause has whole parts left to hold back
  const huge = randomBytes(128 * 1024 * 1024)
  await fsp.writeFile(join(localSrc, 'huge.bin'), huge)
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'huge.bin'), name: 'huge.bin', isDir: false }], destDir: base, policy: 'overwrite' })
  const item = () => transfers.summary().items.find((i) => i.name === 'huge.bin')!
  await until(() => item().status === 'running' && item().transferred > 2 * 1024 * 1024, 60_000, 'upload running')
  transfers.pause(item().id)
  await until(() => item().status === 'paused', 60_000, 'paused')
  const atPause = item().transferred
  await wait(800)
  ok(item().transferred === atPause && atPause < huge.length, `paused upload stays put mid-way (${atPause} of ${huge.length} bytes)`)
  transfers.resume(item().id)
  await until(() => item().status === 'done' || item().status === 'error', 180_000, 'resumed upload done')
  eq(item().status, 'done', 'upload done after resume')
  const hugeBack = await fs.readFile(`${base}/huge.bin`)
  eq(sha256(hugeBack.data), sha256(huge), 'sha256 after pause and resume')

  transfers.clearFinished()
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'huge.bin'), name: 'huge.bin', isDir: false }], destDir: `${base}/cancel`, policy: 'overwrite' })
  await until(() => item().status === 'running' && item().transferred > 1024 * 1024, 60_000, 'second upload running')
  transfers.cancel(item().id)
  await until(() => item().status === 'cancelled', 60_000, 'cancelled')
  await wait(500)
  const pending = await session.require().send(new ListMultipartUploadsCommand({ Bucket: BUCKET, Prefix: `${base.slice(BUCKET.length + 2)}/cancel/` }))
  eq(pending.Uploads?.length ?? 0, 0, 'a cancelled upload leaves no multipart parts behind')

  transfers.clearFinished()
  await fsp.rm(join(localDst, 'huge.bin'), { force: true })
  await transfers.enqueue({ sessionId: info.id, direction: 'download', sources: [{ path: `${base}/huge.bin`, name: 'huge.bin', isDir: false }], destDir: localDst, policy: 'overwrite' })
  await until(() => item().status === 'running' && item().transferred > 8 * 1024 * 1024, 60_000, 'download running')
  transfers.cancel(item().id)
  await until(() => item().status === 'cancelled', 60_000, 'download cancelled')
  const resumeFrom = item().resumeFrom ?? 0
  ok(resumeFrom > 0 && resumeFrom < huge.length, `download keeps resumeFrom=${resumeFrom}`)
  transfers.retry(item().id)
  await until(() => item().status === 'done' || item().status === 'error', 180_000, 'download retry done')
  eq(sha256(await fsp.readFile(join(localDst, 'huge.bin'))), sha256(huge), 'sha256 after resuming a download')

  session.require().middlewareStack.remove('testThrottle')

  console.log('\n[7] Compare, search, share link')
  const cmpLocal = await fsp.mkdtemp(join(tmpdir(), 'cc-s3-cmp-'))
  await fsp.writeFile(join(cmpLocal, 'same.txt'), 'same')
  await fsp.writeFile(join(cmpLocal, 'local-only.txt'), 'x')
  await fs.writeFileAtomic(`${base}/cmp/same.txt`, Buffer.from('same'))
  await fs.writeFileAtomic(`${base}/cmp/remote-only.txt`, Buffer.from('y'))
  const cmp = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: `${base}/cmp` })
  eq(cmp.counts.same, 1, 'uploaded and unchanged: same, despite S3 setting its own date')
  eq(cmp.counts.onlyLocal, 1, 'only local')
  eq(cmp.counts.onlyRemote, 1, 'only on S3')
  // Past the 2 s tolerance compare allows for clock differences
  await wait(2500)
  await fsp.writeFile(join(cmpLocal, 'same.txt'), 'SAME')
  const cmp2 = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: `${base}/cmp` })
  const changed = cmp2.entries.find((e) => e.rel === 'same.txt')
  ok(changed?.status === 'different' && changed.newer === 'local', 'a local edit after upload is newer locally')
  const cmp3 = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: `${base}/cmp`, byHash: true })
  ok(cmp3.hashed && cmp3.entries.find((e) => e.rel === 'same.txt')?.reason === 'hash', 'compare by content uses the ETag')

  const found = await runSearch({ target: info.id, root: base, name: '*.txt' })
  ok(found.hits.some((h) => h.entry.name === 'small.txt'), `search by name walks the bucket (${found.hits.length} hits)`)

  const url = await presignS3(info.id, `${base}/up/nested/small.txt`, 3600)
  const got = await httpGet(url)
  ok(got.status === 200 && got.body.toString() === 'small', 'share link downloads the object')

  console.log('\n[8] Clean up and disconnect')
  await fs.remove(base, true)
  ok(!(await fs.list(`/${BUCKET}`)).some((e) => base.endsWith(e.name)), 'test folder removed')
  sessions.disconnect(info.id)
  eq(sessions.require(info.id).info.status, 'disconnected', 'status disconnected')
  sessions.remove(info.id)
  for (const d of [localSrc, localDst, cmpLocal, userData]) await fsp.rm(d, { recursive: true, force: true }).catch(() => {})

  console.log(`\nResult: ${passes} passed, ${failures} failed`)
  app.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error('\nTEST ABORTED:', e)
  app.exit(2)
})
