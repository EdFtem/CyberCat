/**
 * E2E-тест бекенду: запускається всередині Electron (без вікна) проти тестового sshd.
 *   npx esbuild tests/e2e.ts --bundle --platform=node --format=cjs --outfile=out/test/e2e.cjs \
 *     --external:electron --external:ssh2 --external:iconv-lite --alias:@shared=./src/shared
 *   npx electron out/test/e2e.cjs
 */
import { app } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { promises as fsp } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import net from 'net'
import http from 'http'
import { Client } from 'ssh2'

const HOST = process.env.CC_TEST_HOST ?? '127.0.0.1'
const PORT = Number(process.env.CC_TEST_PORT ?? 2222)
const USER = process.env.CC_TEST_USER ?? 'cat'
const PASS = process.env.CC_TEST_PASS ?? 'catpass'

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
function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}
async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}
async function untilAsync(fn: () => Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now()
  while (!(await fn())) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`)
    await wait(150)
  }
}
async function untilDone(check: () => boolean, timeoutMs: number, label: string): Promise<void> {
  await until(check, timeoutMs, label)
}
async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function until(fn: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`)
    await wait(50)
  }
}

/** Отримати ключ хоста напряму, щоб уникнути діалогу */
function fetchHostKey(host = HOST, port = PORT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const c = new Client()
    let key: Buffer | undefined
    c.on('error', (e) => (key ? resolve(key) : reject(e)))
    c.on('ready', () => {
      c.end()
      resolve(key!)
    })
    c.on('close', () => key && resolve(key))
    c.connect({
      host,
      port,
      username: USER,
      password: PASS,
      hostVerifier: (k: Buffer, verify: (ok: boolean) => void) => {
        key = k
        verify(true)
      }
    })
  })
}

async function main(): Promise<void> {
  const userData = await fsp.mkdtemp(join(tmpdir(), 'cybercat-test-'))
  app.setPath('userData', userData)
  await app.whenReady()

  const { hostKeys } = await import('../src/main/ssh/hostKeys')
  const { sessions } = await import('../src/main/ssh/SessionManager')
  const { RemoteFs } = await import('../src/main/fs/RemoteFs')
  const { openText, saveText } = await import('../src/main/editor/TextEditor')
  const { transfers } = await import('../src/main/transfer/TransferManager')

  console.log('\n[1] Ключ хоста та підключення')
  const hostKey = await fetchHostKey()
  hostKeys.save(HOST, PORT, hostKey)
  ok(hostKeys.lookup(HOST, PORT)?.fingerprint.startsWith('SHA256:'), 'відбиток збережено')

  const info = await sessions.connect({
    adHoc: {
      name: 'test',
      host: HOST,
      port: PORT,
      username: USER,
      auth: 'password',
      savePassword: false
    },
    password: PASS
  })
  eq(info.status, 'connected', 'статус connected')
  ok(info.homeDir && info.homeDir.startsWith('/'), `домашня тека ${info.homeDir}`)
  ok(info.hasShell, 'shell доступний')
  const session = sessions.require(info.id)
  const remote = new RemoteFs(session)
  const home = info.homeDir!

  console.log('\n[2] Операції з файлами на сервері')
  const base = `${home}/cc-test-${randomBytes(3).toString('hex')}`
  await remote.mkdir(base)
  await remote.ensureDir(`${base}/a/b/c`)
  await remote.createFile(`${base}/empty.txt`)
  let threw = false
  try {
    await remote.createFile(`${base}/empty.txt`)
  } catch {
    threw = true
  }
  ok(threw, 'createFile не перезаписує існуючий файл')
  await remote.writeFileAtomic(`${base}/hello.txt`, Buffer.from('привіт\nсвіт\n', 'utf8'))
  const read = await remote.readFile(`${base}/hello.txt`)
  eq(read.data.toString('utf8'), 'привіт\nсвіт\n', 'readFile після writeFileAtomic')
  await remote.chmod(`${base}/hello.txt`, 0o600, false)
  const st = await remote.stat(`${base}/hello.txt`)
  eq(st.mode, 0o600, 'chmod 600')
  await session.exec(`ln -s ${base}/a ${base}/link-to-a`)
  const list = await remote.list(base)
  const names = list.map((e) => e.name).sort()
  eq(names.join(','), 'a,empty.txt,hello.txt,link-to-a', 'список містить усі елементи')
  const link = list.find((e) => e.name === 'link-to-a')!
  ok(link.isSymlink && link.isDir && link.linkTarget === `${base}/a`, 'символічне посилання розпізнано як тека з ціллю')
  ok(list.find((e) => e.name === 'hello.txt')?.owner === USER, `власник з longname = ${USER}`)
  await remote.rename(`${base}/hello.txt`, `${base}/hello2.txt`)
  ok((await remote.list(base)).some((e) => e.name === 'hello2.txt'), 'rename')
  const du = await remote.diskUsage(base)
  ok(du && du.total > 0 && du.free >= 0, `statvfs: free ${du?.free}`)
  await remote.chmod(`${base}/a`, 0o700, true)
  const cst = await remote.stat(`${base}/a/b/c`)
  eq(cst.mode, 0o700, 'рекурсивний chmod')

  console.log('\n[3] Текстовий редактор: кодування, EOL, конфлікти')
  await remote.writeFileAtomic(`${base}/win.txt`, Buffer.from('line1\r\nline2\r\n', 'utf8'))
  const doc = await openText(info.id, `${base}/win.txt`)
  eq(doc.eol, 'CRLF', 'виявлено CRLF')
  eq(doc.encoding, 'utf-8', 'виявлено utf-8')
  const saved = await saveText({ target: info.id, path: doc.path, content: 'line1\nline2\nline3', eol: doc.eol, encoding: doc.encoding, expectedMtime: doc.mtime })
  ok(saved.ok, 'збереження без конфлікту')
  const after = await remote.readFile(`${base}/win.txt`)
  eq(after.data.toString('utf8'), 'line1\r\nline2\r\nline3', 'EOL збережено як CRLF')
  const conflict = await saveText({ target: info.id, path: doc.path, content: 'x', eol: 'LF', encoding: 'utf-8', expectedMtime: doc.mtime - 5000 })
  ok(!conflict.ok && conflict.conflict, 'конфлікт виявлено за mtime')
  const forced = await saveText({ target: info.id, path: doc.path, content: 'x', eol: 'LF', encoding: 'utf-8', expectedMtime: doc.mtime - 5000, force: true })
  ok(forced.ok, 'примусове збереження')
  const cp1251 = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2]) // "Привіт" у windows-1251
  await remote.writeFileAtomic(`${base}/cp.txt`, cp1251)
  const cpDoc = await openText(info.id, `${base}/cp.txt`)
  eq(cpDoc.encoding, 'windows-1251', 'виявлено windows-1251')
  eq(cpDoc.content, 'Привіт', 'декодування cp1251')
  const cpSave = await saveText({ target: info.id, path: cpDoc.path, content: 'Привіт!', eol: 'LF', encoding: cpDoc.encoding, expectedMtime: cpDoc.mtime })
  ok(cpSave.ok && (await remote.readFile(`${base}/cp.txt`)).data.length === 7, 'збережено назад у cp1251')

  console.log('\n[4] Передачі: відвантаження дерева, завантаження, хеші')
  const localSrc = await fsp.mkdtemp(join(tmpdir(), 'cc-src-'))
  await fsp.mkdir(join(localSrc, 'nested', 'deep'), { recursive: true })
  const big = randomBytes(6 * 1024 * 1024 + 123)
  await fsp.writeFile(join(localSrc, 'big.bin'), big)
  await fsp.writeFile(join(localSrc, 'nested', 'small.txt'), 'small')
  await fsp.writeFile(join(localSrc, 'nested', 'deep', 'zero.bin'), Buffer.alloc(0))
  await fsp.writeFile(join(localSrc, 'nested', 'deep', 'mid.bin'), randomBytes(100_000))

  await transfers.enqueue({
    sessionId: info.id,
    direction: 'upload',
    sources: [
      { path: join(localSrc, 'big.bin'), name: 'big.bin', isDir: false },
      { path: join(localSrc, 'nested'), name: 'nested', isDir: true }
    ],
    destDir: `${base}/up`
  })
  const allDone = (): boolean => transfers.summary().items.every((i) => ['done', 'error', 'skipped', 'cancelled'].includes(i.status))
  await until(allDone, 60_000, 'upload done')
  let items = transfers.summary().items
  eq(items.length, 4, 'у черзі 4 файли')
  ok(items.every((i) => i.status === 'done'), `усі done: ${items.map((i) => `${i.name}:${i.status}${i.error ? '(' + i.error + ')' : ''}`).join(', ')}`)
  const remoteHash = (p: string): Promise<string> => session.exec(`sha256sum ${p} | cut -d' ' -f1`).then((r) => r.stdout.trim())
  eq(await remoteHash(`${base}/up/big.bin`), sha256(big), 'sha256 big.bin на сервері')
  eq(await remoteHash(`${base}/up/nested/deep/mid.bin`), sha256(await fsp.readFile(join(localSrc, 'nested', 'deep', 'mid.bin'))), 'sha256 вкладеного файлу')
  eq((await remote.stat(`${base}/up/nested/deep/zero.bin`)).size, 0, 'порожній файл відвантажено')
  const srcMtime = (await fsp.stat(join(localSrc, 'big.bin'))).mtimeMs
  ok(Math.abs((await remote.stat(`${base}/up/big.bin`)).mtime - srcMtime) < 2000, 'mtime збережено')

  transfers.clearFinished()
  const localDst = await fsp.mkdtemp(join(tmpdir(), 'cc-dst-'))
  await transfers.enqueue({
    sessionId: info.id,
    direction: 'download',
    sources: [{ path: `${base}/up`, name: 'up', isDir: true }],
    destDir: localDst
  })
  await until(allDone, 60_000, 'download done')
  items = transfers.summary().items
  ok(items.length === 4 && items.every((i) => i.status === 'done'), `завантаження: ${items.map((i) => i.status).join(',')}`)
  eq(sha256(await fsp.readFile(join(localDst, 'up', 'big.bin'))), sha256(big), 'sha256 завантаженого big.bin')
  eq((await fsp.readFile(join(localDst, 'up', 'nested', 'small.txt'))).toString(), 'small', 'вкладений текстовий файл')

  console.log('\n[5] Передачі: політики перезапису, пауза, скасування та відновлення')
  transfers.clearFinished()
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'big.bin'), name: 'big.bin', isDir: false }], destDir: `${base}/up`, policy: 'skip' })
  await until(allDone, 30_000, 'skip done')
  eq(transfers.summary().items[0].status, 'skipped', 'політика skip')
  transfers.clearFinished()
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'big.bin'), name: 'big.bin', isDir: false }], destDir: `${base}/up`, policy: 'overwrite' })
  await until(allDone, 60_000, 'overwrite done')
  eq(transfers.summary().items[0].status, 'done', 'політика overwrite')
  transfers.clearFinished()

  const huge = randomBytes(40 * 1024 * 1024)
  await fsp.writeFile(join(localSrc, 'huge.bin'), huge)
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: join(localSrc, 'huge.bin'), name: 'huge.bin', isDir: false }], destDir: `${base}/up` })
  const item = (): typeof items[number] => transfers.summary().items[0]
  await until(() => item().status === 'running' && item().transferred > 1024 * 1024, 30_000, 'running')
  transfers.pause(item().id)
  await until(() => item().status === 'paused', 10_000, 'paused')
  const atPause = item().transferred
  await wait(700)
  ok(item().transferred - atPause < 2 * 1024 * 1024, `на паузі передача зупинилась (${item().transferred - atPause} байт після паузи)`)
  transfers.resume(item().id)
  await until(() => item().status === 'running', 10_000, 'resumed')
  await until(() => item().transferred > atPause + 2 * 1024 * 1024, 30_000, 'progress after resume')
  transfers.cancel(item().id)
  await until(() => item().status === 'cancelled', 10_000, 'cancelled')
  const resumeFrom = item().resumeFrom ?? 0
  ok(resumeFrom > 0 && resumeFrom < huge.length, `після скасування resumeFrom=${resumeFrom}`)
  const partialSize = (await remote.stat(`${base}/up/huge.bin`)).size
  eq(partialSize, resumeFrom, 'частковий файл обрізано до resumeFrom')
  transfers.retry(item().id)
  await until(() => item().status === 'done', 120_000, 'retry done')
  eq(await remoteHash(`${base}/up/huge.bin`), sha256(huge), 'sha256 після відновлення збігається')
  ok(item().transferred === huge.length, 'лічильник байтів дорівнює розміру')

  console.log('\n[6a] ssh config: розбір і ефективні опції')
  const { parseSshConfigText, hostFromBlocks, matchesPatterns } = await import('../src/main/ssh/sshConfig')
  const blocks = parseSshConfigText(`
# коментар
IdentityFile ~/.ssh/global_key
Host !prod-eu prod-*
    Port 2300
Host prod prod-*
    HostName prod.example.com
    User deploy
    Port 2200
    IdentityFile ~/.ssh/prod_key
    ProxyJump bastion
Host bastion
    HostName bastion.example.com
    User jump
Host *
    User fallback
`)
  const prod = hostFromBlocks(blocks, 'prod')
  eq(prod.host, 'prod.example.com', 'HostName')
  eq(prod.user, 'deploy', 'User')
  eq(prod.port, 2200, 'Port')
  eq(prod.proxyJump, 'bastion', 'ProxyJump')
  eq(hostFromBlocks(blocks, 'prod-us').port, 2300, 'перший збіг виграє')
  eq(hostFromBlocks(blocks, 'prod-eu').port, 2200, 'заперечний шаблон виключає блок')
  eq(hostFromBlocks(blocks, 'unknown').user, 'fallback', 'Host * як запасний варіант')
  eq(hostFromBlocks(blocks, 'unknown').host, 'unknown', 'HostName за замовчуванням дорівнює alias')
  ok(
    matchesPatterns(['*.example.com', '!bad.example.com'], 'good.example.com') && !matchesPatterns(['*.example.com', '!bad.example.com'], 'bad.example.com'),
    'глоб-шаблони з запереченням'
  )
  const { parseProxyJump } = await import('../src/main/ssh/Session')
  const pj = parseProxyJump('jump@bastion:2222, other, [::1]:22')
  ok(
    pj.length === 3 && pj[0].user === 'jump' && pj[0].host === 'bastion' && pj[0].port === 2222 && pj[1].host === 'other' && pj[1].port === undefined && pj[2].host === '::1' && pj[2].port === 22,
    'розбір ProxyJump'
  )

  console.log('\n[6b] Живий перегляд логу')
  const { tails } = await import('../src/main/tail/TailService')
  const { bus } = await import('../src/main/bus')
  const logPath = `${base}/app.log`
  await remote.writeFileAtomic(logPath, Buffer.from('line1\nline2\n'))
  const received: string[] = []
  let tailId = ''
  const onTail = (d: { tailId: string; data: string }): void => {
    if (d.tailId === tailId) received.push(d.data)
  }
  bus.on('tail:data', onTail)
  tailId = await tails.start(info.id, logPath, 100)
  await until(() => tails.snapshot(tailId).text.includes('line2'), 5000, 'tail initial')
  await session.exec(`echo line3 >> ${logPath}`)
  await until(() => received.join('').includes('line3'), 8000, 'tail live')
  ok(true, 'tail -F через shell отримує нові рядки')
  const snap = tails.snapshot(tailId)
  ok(snap.text.includes('line1') && snap.text.includes('line3') && snap.seq >= 2, `snapshot містить історію (seq ${snap.seq})`)
  tails.stop(tailId)
  bus.off('tail:data', onTail)

  const localLog = join(localSrc, 'local.log')
  await fsp.writeFile(localLog, 'a\nb\n')
  const received2: string[] = []
  let tail2 = ''
  const onTail2 = (d: { tailId: string; data: string }): void => {
    if (d.tailId === tail2) received2.push(d.data)
  }
  bus.on('tail:data', onTail2)
  tail2 = await tails.start('local', localLog, 100)
  await until(() => tails.snapshot(tail2).text.includes('b'), 5000, 'local tail initial')
  await fsp.appendFile(localLog, 'c\n')
  await until(() => received2.join('').includes('c'), 8000, 'local tail poll')
  ok(true, 'опитування локального файлу підхоплює дописані рядки')
  tails.stop(tail2)
  bus.off('tail:data', onTail2)

  console.log('\n[6c] Пошук')
  const { runSearch } = await import('../src/main/search/SearchService')
  await remote.writeFileAtomic(`${base}/a/needle.txt`, Buffer.from('hello\nfind me here\n'))
  const byName = await runSearch({ target: info.id, root: base, name: 'needle' })
  ok(byName.method === 'shell' && byName.hits.some((h) => h.entry.path === `${base}/a/needle.txt`), `пошук за назвою через shell (${byName.hits.length})`)
  const byContent = await runSearch({ target: info.id, root: base, content: 'FIND ME' })
  const hit = byContent.hits.find((h) => h.entry.path === `${base}/a/needle.txt`)
  ok(!!hit && hit.line === 2 && /find me/i.test(hit.text ?? ''), `пошук за вмістом без урахування регістру: рядок ${hit?.line}, «${hit?.text}»`)
  const byBoth = await runSearch({ target: info.id, root: base, name: '*.txt', content: 'hello', caseSensitive: true })
  ok(byBoth.hits.length === 1 && byBoth.hits[0].entry.name === 'needle.txt', 'назва і вміст разом')
  const walked = await runSearch({ target: 'local', root: localSrc, name: '*.bin' })
  ok(walked.method === 'walk' && walked.hits.length >= 3, `локальний пошук за назвою: ${walked.hits.length} збігів`)
  const walkedContent = await runSearch({ target: 'local', root: localSrc, content: 'small' })
  ok(walkedContent.hits.some((h) => h.entry.name === 'small.txt' && h.line === 1), 'локальний пошук за вмістом')

  console.log('\n[6d] ProxyJump')
  if (process.env.CC_TEST_JUMP && process.env.CC_TEST_TARGET) {
    const jm = /^(?:(.+)@)?([^:]+)(?::(\d+))?$/.exec(process.env.CC_TEST_JUMP)!
    const tm = /^([^:]+)(?::(\d+))?$/.exec(process.env.CC_TEST_TARGET)!
    const jumpHost = jm[2]
    const jumpPort = Number(jm[3] ?? 22)
    const targetHost = tm[1]
    const targetPort = Number(tm[2] ?? 22)
    hostKeys.save(jumpHost, jumpPort, await fetchHostKey(jumpHost, jumpPort))
    // Цільовий сервер з боку bastion має іншу адресу, але той самий ключ
    hostKeys.save(targetHost, targetPort, hostKey)
    const viaJump = await sessions.connect({
      adHoc: { name: 'via-jump', host: targetHost, port: targetPort, username: USER, auth: 'password', savePassword: false, proxyJump: process.env.CC_TEST_JUMP },
      password: PASS
    })
    eq(viaJump.status, 'connected', 'підключення через ProxyJump')
    const viaList = await new RemoteFs(sessions.require(viaJump.id)).list(viaJump.homeDir!)
    ok(viaList.length > 0, `список тек через тунель (${viaList.length})`)
    const viaExec = await sessions.require(viaJump.id).exec('hostname')
    ok(viaExec.stdout.trim().length > 0, `shell через тунель: ${viaExec.stdout.trim()}`)
    sessions.remove(viaJump.id)
  } else {
    console.log('  - пропущено: задайте CC_TEST_JUMP=cat@127.0.0.1:2223 і CC_TEST_TARGET=<ip контейнера>:2222')
  }

  console.log('\n[6e] sudo-режим')
  const sudoProbe = await session.exec('sudo -n true 2>&1')
  if (/not found|No such file/i.test(sudoProbe.stdout + sudoProbe.stderr)) {
    console.log('  - пропущено: на сервері немає sudo')
  } else {
    await session.enableSudo(PASS)
    ok(session.sudoActive && session.info.sudo === true, 'sudo увімкнено')
    const rootDir = `/root/cc-sudo-${randomBytes(3).toString('hex')}`
    await remote.mkdir(rootDir)
    await remote.writeFileAtomic(`${rootDir}/x.txt`, Buffer.from('root'))
    const made = await remote.list(rootDir)
    ok(made.length === 1 && made[0].owner === 'root', `файл у /root створено від root (власник ${made[0]?.owner})`)
    const whoami = await session.exec('id -u')
    eq(whoami.stdout.trim(), '0', 'exec у sudo-режимі виконується від root')
    await remote.remove(rootDir, true)
    let goneRoot = false
    try {
      await remote.stat(rootDir)
    } catch {
      goneRoot = true
    }
    ok(goneRoot, 'rm -rf через sudo')
    session.disableSudo()
    ok(!session.sudoActive && session.info.sudo === false, 'sudo вимкнено')
    eq((await session.exec('id -un')).stdout.trim(), USER, 'exec знову від звичайного користувача')
    let denied = false
    try {
      await remote.mkdir(`/root/cc-denied-${randomBytes(2).toString('hex')}`)
    } catch {
      denied = true
    }
    ok(denied, 'без sudo запис у /root заборонено')
  }

  console.log('\n[6f] Переміщення, копіювання, порівняння, стеження')
  const { localFs } = await import('../src/main/fs/LocalFs')
  const { runCompare } = await import('../src/main/sync/CompareService')
  const { watches } = await import('../src/main/sync/WatchService')
  const allFinished = (): boolean => transfers.summary().items.every((i) => ['done', 'error', 'skipped', 'cancelled'].includes(i.status))

  const moveSrc = join(localSrc, 'movedir')
  await fsp.mkdir(join(moveSrc, 'sub'), { recursive: true })
  await fsp.writeFile(join(moveSrc, 'a.txt'), 'a')
  await fsp.writeFile(join(moveSrc, 'sub', 'b.txt'), 'b')
  transfers.clearFinished()
  await transfers.enqueue({ sessionId: info.id, direction: 'upload', sources: [{ path: moveSrc, name: 'movedir', isDir: true }], destDir: `${base}/moved`, move: true })
  await untilDone(allFinished, 60_000, 'move done')
  await wait(500)
  ok(transfers.summary().items.every((i) => i.status === 'done'), 'переміщення: усі файли передано')
  eq((await remote.stat(`${base}/moved/movedir/sub/b.txt`)).size, 1, 'файл є на сервері після переміщення')
  ok(!(await exists(moveSrc)), 'локальне джерело видалено разом із порожніми теками')

  await remote.copy(`${base}/moved/movedir`, `${base}/moved/copy`)
  eq((await remote.stat(`${base}/moved/copy/sub/b.txt`)).size, 1, 'копіювання на сервері через cp -a')
  await localFs.copy(join(localSrc, 'nested'), join(localSrc, 'nested-copy'))
  ok(await exists(join(localSrc, 'nested-copy', 'deep', 'mid.bin')), 'локальне рекурсивне копіювання')

  const cmpLocal = await fsp.mkdtemp(join(tmpdir(), 'cc-cmp-'))
  const cmpRemote = `${base}/cmp`
  await remote.mkdir(cmpRemote)
  await fsp.writeFile(join(cmpLocal, 'same.txt'), 'same content')
  await remote.writeFileAtomic(`${cmpRemote}/same.txt`, Buffer.from('same content'))
  await fsp.writeFile(join(cmpLocal, 'only-local.txt'), 'L')
  await remote.writeFileAtomic(`${cmpRemote}/only-remote.txt`, Buffer.from('R'))
  await fsp.writeFile(join(cmpLocal, 'diff.txt'), 'aaaa')
  await remote.writeFileAtomic(`${cmpRemote}/diff.txt`, Buffer.from('bbbb'))
  await fsp.mkdir(join(cmpLocal, 'sub'))
  await fsp.writeFile(join(cmpLocal, 'sub', 'deep.txt'), 'deep')
  const cmp = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: cmpRemote, byHash: true })
  ok(cmp.hashed, 'хешування увімкнено')
  eq(cmp.counts.onlyLocal, 3, 'лише локально: only-local.txt, sub, sub/deep.txt')
  eq(cmp.counts.onlyRemote, 1, 'лише на сервері: only-remote.txt')
  const diffEntry = cmp.entries.find((e) => e.rel === 'diff.txt')
  ok(!!diffEntry && diffEntry.status === 'different' && diffEntry.reason === 'hash', 'однаковий розмір, різний вміст виявлено за sha256')
  eq(cmp.counts.same, 1, 'same.txt збігається за хешем')
  const cmpSameTime = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: cmpRemote })
  ok(!cmpSameTime.entries.some((e) => e.rel === 'diff.txt'), 'без хешу однаковий розмір і дата вважаються збігом')
  const older = (Date.now() - 60_000) / 1000
  await fsp.utimes(join(cmpLocal, 'diff.txt'), older, older)
  const cmpQuick = await runCompare({ sessionId: info.id, localDir: cmpLocal, remoteDir: cmpRemote })
  const diffQuick = cmpQuick.entries.find((e) => e.rel === 'diff.txt')
  ok(!!diffQuick && diffQuick.status === 'different' && diffQuick.reason === 'mtime' && diffQuick.newer === 'remote', 'без хешу відмінність за датою, новіший на сервері')

  const w = watches.start(info.id, cmpLocal, cmpRemote)
  ok(watches.list().some((x) => x.id === w.id), 'стеження запущено')
  await wait(400)
  await fsp.writeFile(join(cmpLocal, 'watched.txt'), 'watched!')
  await untilAsync(async () => {
    try {
      return (await remote.stat(`${cmpRemote}/watched.txt`)).size === 8
    } catch {
      return false
    }
  }, 20_000, 'watch upload')
  ok(true, 'новий локальний файл автоматично відвантажено')
  await fsp.mkdir(join(cmpLocal, 'newdir'))
  await fsp.writeFile(join(cmpLocal, 'newdir', 'inner.txt'), 'inner')
  await untilAsync(async () => {
    try {
      return (await remote.stat(`${cmpRemote}/newdir/inner.txt`)).size === 5
    } catch {
      return false
    }
  }, 20_000, 'watch nested upload')
  ok(true, 'файл у новій підтеці відвантажено')
  watches.stop(w.id)
  ok(!watches.list().some((x) => x.id === w.id), 'стеження зупинено')
  await fsp.rm(cmpLocal, { recursive: true, force: true })

  console.log('\n[6g] Docker: розбір портів, виявлення, тунелі')
  const dockerSvc = await import('../src/main/docker/DockerService')
  const { tunnels } = await import('../src/main/tunnel/TunnelService')
  const ports = dockerSvc.parsePorts('0.0.0.0:8080->80/tcp, :::8080->80/tcp, 127.0.0.1:5432->5432/tcp, 9000/tcp, 0.0.0.0:53->53/udp')
  ok(
    ports.length === 4 &&
      ports[0].hostPort === 53 &&
      ports[0].proto === 'udp' &&
      ports[1].hostPort === 5432 &&
      ports[1].hostIp === '127.0.0.1' &&
      ports[2].hostPort === 8080 &&
      ports[2].containerPort === 80 &&
      ports[3].hostPort === undefined &&
      ports[3].containerPort === 9000,
    `розбір портів без дублікатів IPv6 (${ports.length} записи)`
  )

  const tun = await tunnels.start(info.id, '127.0.0.1', 2222)
  ok(tun.localPort > 0, `тунель localhost:${tun.localPort} → 127.0.0.1:2222 відкрито`)
  const banner = await new Promise<string>((resolve, reject) => {
    const sock = net.connect(tun.localPort, '127.0.0.1')
    const timer = setTimeout(() => {
      sock.destroy()
      reject(new Error('timeout: banner'))
    }, 8000)
    sock.once('data', (d) => {
      clearTimeout(timer)
      sock.destroy()
      resolve(d.toString())
    })
    sock.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    sock.on('close', () => {
      clearTimeout(timer)
      reject(new Error('тунель закрив з’єднання без даних: сервер відхилив forwardOut'))
    })
  })
  ok(banner.startsWith('SSH-2.0'), `через тунель видно банер sshd: ${banner.trim()}`)
  tunnels.stop(tun.id)
  ok(!tunnels.list().some((t) => t.id === tun.id), 'тунель закрито')

  let dinfo = await dockerSvc.detectDocker(info.id, true)
  console.log(`  - docker: available=${dinfo.available} cli=${dinfo.cli} compose=${dinfo.compose} needsSudo=${dinfo.needsSudo ?? false} error=${dinfo.error ?? ''}`)
  if (!dinfo.available) {
    console.log('  - пропущено: на тестовому сервері немає docker')
  } else {
    if (dinfo.error && dinfo.needsSudo) {
      ok(true, 'без доступу до сокета повідомляє про потребу в sudo')
      await session.enableSudo(PASS)
      dinfo = await dockerSvc.detectDocker(info.id, true)
    }
    ok(dinfo.available && !dinfo.error, `docker доступний: ${dinfo.cli} ${dinfo.serverVersion}`)
    const victim = `cybercat-victim-${randomBytes(2).toString('hex')}`
    const run = await session.exec(`docker run -d --name ${victim} -p 18080:80 nginx:alpine 2>&1`, 120_000)
    ok(run.code === 0, `тестовий контейнер ${victim} запущено`)
    try {
      await wait(1500)
      let list = await dockerSvc.listContainers(info.id)
      const me = list.find((c) => c.name === victim)
      ok(!!me && me.state === 'running' && me.ports.some((p) => p.hostPort === 18080 && p.containerPort === 80), `контейнер у списку з портом 18080→80 (${me?.ports.map((p) => p.hostPort).join(',')})`)
      ok(list.some((c) => c.name === 'cybercat-sshd'), 'список містить контейнери хоста')
      const insp = (await dockerSvc.inspectContainer(info.id, me!.id)) as { Config?: { Image?: string }; NetworkSettings?: { IPAddress?: string; Networks?: Record<string, { IPAddress: string }> } }
      eq(insp.Config?.Image, 'nginx:alpine', 'inspect повертає образ')
      const victimIp = insp.NetworkSettings?.IPAddress || Object.values(insp.NetworkSettings?.Networks ?? {})[0]?.IPAddress
      ok(!!victimIp, `IP контейнера ${victimIp}`)

      const logTail = await tails.startCommand(info.id, await dockerSvc.logsCommand(info.id, me!.id, 50))
      const web = await tunnels.start(info.id, victimIp!, 80)
      const status = await new Promise<number>((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: web.localPort, path: '/', timeout: 8000 }, (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        })
        req.on('error', reject)
        req.on('timeout', () => reject(new Error('timeout: http через тунель')))
      })
      eq(status, 200, 'HTTP 200 від nginx через SSH-тунель')
      await until(() => /GET \/ HTTP/.test(tails.snapshot(logTail).text), 10_000, 'docker logs')
      ok(true, 'docker logs -f показав запит, зроблений через тунель')
      tails.stop(logTail)
      tunnels.stop(web.id)

      await dockerSvc.containerAction(info.id, me!.id, 'stop')
      await untilAsync(async () => (await dockerSvc.listContainers(info.id)).find((c) => c.name === victim)?.state === 'exited', 15_000, 'stop → exited')
      ok(true, 'stop → exited')
      await dockerSvc.containerAction(info.id, me!.id, 'start')
      await untilAsync(async () => (await dockerSvc.listContainers(info.id)).find((c) => c.name === victim)?.state === 'running', 15_000, 'start → running')
      ok(true, 'start → running')
      list = await dockerSvc.listContainers(info.id)
      const images = await dockerSvc.listImages(info.id)
      ok(images.some((i) => i.repository === 'nginx' && i.tag === 'alpine' && i.inUse), 'образ nginx:alpine позначено як використовуваний')
      const df = await dockerSvc.diskUsage(info.id)
      ok(df.some((d) => /Images/i.test(d.type)), `system df: ${df.map((d) => `${d.type}=${d.size}`).join(', ')}`)
      const shellCmd = await dockerSvc.execShellCommand(info.id, me!.id)
      ok(/docker exec -it/.test(shellCmd) && (session.sudoActive ? shellCmd.startsWith('sudo ') : true), `команда shell: ${shellCmd.slice(0, 60)}…`)
      const composeCmd = await dockerSvc.composeCommand(info.id, 'demo', '/srv/demo', ['/srv/demo/docker-compose.yml'], 'up -d')
      ok(/compose -p 'demo' --project-directory '\/srv\/demo' -f '\/srv\/demo\/docker-compose.yml' up -d$/.test(composeCmd), 'команда compose з проєктом, текою та файлом')
      await dockerSvc.containerAction(info.id, me!.id, 'rm', true)
      list = await dockerSvc.listContainers(info.id)
      ok(!list.some((c) => c.name === victim), 'rm -f прибрав контейнер')
    } finally {
      await session.exec(`docker rm -f ${victim} >/dev/null 2>&1 || true`)
      if (session.sudoActive) session.disableSudo()
    }
  }

  console.log('\n[6] Термінал (shell) та видалення')
  const shell = await session.shell(80, 24)
  let out = ''
  shell.on('data', (d: Buffer) => (out += d.toString()))
  shell.write('echo CC_$((40+2))\n')
  await until(() => out.includes('CC_42'), 10_000, 'shell output')
  ok(out.includes('CC_42'), 'shell виконує команди')
  shell.close()

  await remote.remove(base, true)
  let gone = false
  try {
    await remote.stat(base)
  } catch {
    gone = true
  }
  ok(gone, 'рекурсивне видалення тестової теки')

  console.log('\n[7] Відключення')
  sessions.disconnect(info.id)
  await wait(300)
  eq(sessions.require(info.id).info.status, 'disconnected', 'статус disconnected')
  sessions.remove(info.id)

  await fsp.rm(localSrc, { recursive: true, force: true })
  await fsp.rm(localDst, { recursive: true, force: true })
  await fsp.rm(userData, { recursive: true, force: true }).catch(() => {})

  console.log(`\nРезультат: ${passes} пройдено, ${failures} провалено`)
  app.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error('\nТЕСТ ЗУПИНЕНО:', e)
  app.exit(2)
})
