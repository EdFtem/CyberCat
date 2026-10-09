/**
 * UI smoke check: takes screenshots of the main window and prints diagnostics.
 * Run: npm run test:ui (see tests/run-ui-smoke.cjs). CC_UI_LANG=uk runs it in Ukrainian.
 * Needs the test sshd (see README) on 127.0.0.1:2222, user cat/catpass.
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { createHash } = require('crypto')
const { Client } = require(path.join(process.cwd(), 'node_modules', 'ssh2'))

const HOST = process.env.CC_TEST_HOST || '127.0.0.1'
const PORT = Number(process.env.CC_TEST_PORT || 2222)
const USER = process.env.CC_TEST_USER || 'cat'
const PASS = process.env.CC_TEST_PASS || 'catpass'
const SHOTS = process.env.CYBERCAT_SHOTS || path.join(process.cwd(), 'out', 'shots')
const LANG = process.env.CC_UI_LANG || 'en'
// Short fixed paths, so screenshots show tidy demo folders instead of your own files
const TMP = process.platform === 'win32' ? os.tmpdir() : '/tmp'
const DEMO_DIR = path.join(TMP, 'cybercat-demo')
const COMPARE_DIR = path.join(TMP, 'cybercat-compare')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The app's own dictionaries, compiled on the fly, so selectors follow the UI text in any language */
function loadI18n() {
  const { buildSync } = require(path.join(process.cwd(), 'node_modules', 'esbuild'))
  const out = buildSync({
    entryPoints: [path.join(process.cwd(), 'src', 'shared', 'i18n', 'index.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    logLevel: 'silent'
  })
  const mod = { exports: {} }
  new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
  return mod.exports
}

function makeDemoFolder() {
  fs.rmSync(DEMO_DIR, { recursive: true, force: true })
  const files = {
    'README.md': '# Website\n\nStatic site and deployment scripts.\n',
    'deploy.sh': '#!/bin/sh\nset -e\nrsync -av --delete ./site/ cat@example.com:/var/www/site/\n',
    'nginx.conf': 'server {\n  listen 443 ssl;\n  server_name example.com;\n  root /var/www/site;\n}\n',
    'docker-compose.yml': 'services:\n  web:\n    image: nginx:alpine\n',
    'backups/site-2026-10-01.tar.gz': Buffer.alloc(48 * 1024, 7),
    'site/index.html': '<!doctype html>\n<title>Example</title>\n<h1>Hello</h1>\n',
    'site/styles.css': 'body { font-family: system-ui; }\n',
    'logs/access.log': '127.0.0.1 - - [09/Oct/2026:09:30:01 +0000] "GET / HTTP/1.1" 200 512\n'
  }
  for (const [rel, data] of Object.entries(files)) {
    const p = path.join(DEMO_DIR, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, data)
  }
}

function fetchHostKey() {
  return new Promise((resolve, reject) => {
    const c = new Client()
    let key
    c.on('error', (e) => (key ? resolve(key) : reject(e)))
    c.on('ready', () => {
      c.end()
      resolve(key)
    })
    c.connect({
      host: HOST,
      port: PORT,
      username: USER,
      password: PASS,
      hostVerifier: (k, verify) => {
        key = k
        verify(true)
      }
    })
  })
}

const COMPOSE_DEMO = `services:
  web:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./site:/usr/share/nginx/html:ro
    depends_on:
      - api

  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/app
      LOG_LEVEL: info
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`

module.exports = ({ win, app }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f), { force: true })
  const i18n = loadI18n()
  const M = i18n.getMessages(LANG)
  const shot = async (name) => {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(SHOTS, `${name}.png`), img.toPNG())
    console.log(`[smoke] shot ${name}`)
  }
  const js = (code) => win.webContents.executeJavaScript(code, true)
  /** Polls a page expression until it is truthy; returns whether it got there in time */
  const waitFor = async (expr, timeout = 10000) => {
    for (const end = Date.now() + timeout; Date.now() < end; await sleep(200)) if (await js(`!!(${expr})`)) return true
    return false
  }
  const click = (selector) => js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
  const byTitle = (title) => `button[title=${JSON.stringify(title)}]`
  const clickByText = (selector, text) =>
    js(
      `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true })()`
    )
  const escape = () => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  const dismissToasts = () => js(`document.querySelectorAll('.toast-in button').forEach((b) => b.click())`)
  const remoteRow = (contains) =>
    `[...document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row')].find((r) => r.textContent.includes(${JSON.stringify(contains)}))`
  const setInput = (selector, value) =>
    js(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`
    )

  // Keep timers and painting at full speed when the window is behind others (macOS throttles occluded windows)
  win.webContents.setBackgroundThrottling(false)

  win.webContents.once('did-finish-load', async () => {
    let info
    try {
      console.log(`[smoke] language: ${LANG}`)
      makeDemoFolder()
      await sleep(1800)
      await shot('01-home')

      // Trust the host key upfront so the host key dialog does not block the run
      const key = await fetchHostKey()
      const fp = 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
      const len = key.readUInt32BE(0)
      const keyType = key.subarray(4, 4 + len).toString('ascii')
      const id = PORT === 22 ? HOST : `[${HOST}]:${PORT}`
      fs.writeFileSync(
        path.join(app.getPath('userData'), 'known_hosts.json'),
        JSON.stringify({ [id]: { keyType, fingerprint: fp, key: key.toString('base64'), addedAt: Date.now() } })
      )

      const t0 = Date.now()
      info = await js(
        `window.api.sessions.connect({ adHoc: { name: 'docker sshd', host: ${JSON.stringify(HOST)}, port: ${PORT}, username: ${JSON.stringify(USER)}, auth: 'password', savePassword: false, color: '#22d3ee', localPath: ${JSON.stringify(DEMO_DIR)} }, password: ${JSON.stringify(PASS)} })`
      )
      console.log(`[smoke] connected in ${Date.now() - t0} ms: status=${info && info.status} home=${info && info.homeDir} shell=${info && info.hasShell}`)
      await sleep(3500)
      await shot('02-session')
      console.log(`[smoke] remote rows visible: ${await js(`document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row').length`)}`)

      // Terminal via Ctrl+`
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: '`', modifiers: ['control'] })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: '`', modifiers: ['control'] })
      await sleep(3000)
      await shot('03-terminal')

      // Context menu on a row of the server pane
      const openMenu = (contains) =>
        js(
          `(() => { const el = ${remoteRow(contains)} || document.querySelector('[id^="filelist-"][id$="-remote"] .file-row'); if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 80, clientY: r.top + 14, button: 2 })); return true })()`
        )
      await openMenu('sshd.pid')
      await sleep(600)
      await shot('04-context-menu')
      console.log(`[smoke] context menu visible: ${await js(`!!document.querySelector('.fixed.z-\\\\[71\\\\]')`)}`)
      await escape()
      await sleep(300)

      // Demo files on the server: a compose file for the editor and a log with levels for the live view
      const composePath = `${info.homeDir}/docker-compose.yml`
      const logPath = `${info.homeDir}/cybercat-demo.log`
      const saveRemote = (p, content) =>
        js(`window.api.text.save({ target: ${JSON.stringify(info.id)}, path: ${JSON.stringify(p)}, content: ${JSON.stringify(content)}, eol: 'LF', encoding: 'utf-8' })`)
      await saveRemote(composePath, COMPOSE_DEMO)
      await saveRemote(
        logPath,
        [
          '2026-10-09 09:30:01 INFO  server started on :8080',
          '2026-10-09 09:30:02 DEBUG loading config from /etc/app.yml',
          '2026-10-09 09:30:05 WARN  cache miss ratio 0.42 above threshold',
          '2026-10-09 09:30:09 ERROR upstream timeout after 5000 ms (attempt 3)',
          '2026-10-09 09:30:10 INFO  retrying upstream connection',
          ''
        ].join('\n')
      )
      await js(`[...document.querySelectorAll(${JSON.stringify(byTitle(M.pane.refreshHint))})].pop().click()`)
      await sleep(1500)

      // Open a file in the editor with a double click
      const opened = await js(
        `(() => { const el = ${remoteRow('docker-compose.yml')}; if (!el) return false; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); return true })()`
      )
      await waitFor(`document.querySelector('.monaco-editor .view-line:nth-child(12)')`)
      await sleep(800)
      await dismissToasts()
      await shot('05-editor')
      console.log(`[smoke] editor opened: ${opened}, monaco present: ${await js(`!!document.querySelector('.monaco-editor')`)}`)
      await click(byTitle(M.editor.backToFiles))
      await sleep(500)

      // Live log view from the context menu
      console.log(`[smoke] demo log row present: ${await waitFor(remoteRow('cybercat-demo.log'), 5000)}`)
      await openMenu('cybercat-demo.log')
      await sleep(400)
      const tailClicked = await clickByText('.fixed.z-\\[71\\] button', M.pane.followLog)
      await sleep(2500)
      // append a line to check that the view is live
      await js(
        `window.api.terminal.open(${JSON.stringify(info.id)}, 80, 24).then((t) => { window.api.terminal.write(t, 'echo "2026-10-09 09:30:15 ERROR disk /var 97% full" >> ${logPath}\\n'); setTimeout(() => window.api.terminal.close(t), 1500) })`
      )
      await waitFor(`[...document.querySelectorAll('.font-mono .h-5')].some((r) => r.textContent.includes('97% full'))`)
      await sleep(500)
      await dismissToasts()
      await shot('06-logview')
      console.log(`[smoke] log view opened: ${tailClicked}, live rows: ${await js(`document.querySelectorAll('.font-mono .h-5').length`)}`)
      await click(byTitle(M.editor.backToFiles))
      await sleep(400)

      // Search with Ctrl+Shift+F on the server pane
      await js(`document.querySelector('[id^="filelist-"][id$="-remote"]').focus()`)
      await js(
        `document.querySelector('[id^="filelist-"][id$="-remote"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true, bubbles: true }))`
      )
      await sleep(500)
      await setInput('input[placeholder="*.conf"]', 'ssh')
      await setInput('input[placeholder="listen 443"]', '')
      await clickByText('.fixed.z-50 button', M.search.run)
      await sleep(2500)
      await shot('07-search')
      console.log(`[smoke] search results: ${await js(`document.querySelectorAll('.fixed.z-50 .group').length`)}`)
      await escape()
      await sleep(300)

      // sudo mode: button, password dialog, root badge
      await click(`button[title^=${JSON.stringify(M.pane.sudoOn.split(':')[0])}]`)
      await sleep(900)
      await shot('07b-sudo-prompt')
      await setInput('.fixed.z-50 input[type=password]', PASS)
      await clickByText('.fixed.z-50 button', M.common.continue)
      await sleep(2500)
      await shot('07c-sudo-active')
      console.log(`[smoke] sudo badge: ${await js(`!![...document.querySelectorAll('section span')].find((s) => s.textContent.trim() === 'root')`)}`)
      await click(byTitle(M.pane.sudoOff))
      await sleep(800)

      // Folder compare with a small local folder
      fs.rmSync(COMPARE_DIR, { recursive: true, force: true })
      fs.mkdirSync(COMPARE_DIR, { recursive: true })
      fs.writeFileSync(path.join(COMPARE_DIR, 'sshd.pid'), '198\n')
      fs.writeFileSync(path.join(COMPARE_DIR, 'docker-compose.yml'), COMPOSE_DEMO)
      fs.writeFileSync(path.join(COMPARE_DIR, 'local-only.txt'), 'hello')
      await dismissToasts()
      await click(byTitle(M.pane.compareWithLocal))
      await sleep(600)
      await setInput('.fixed.z-50 input.input-mono', COMPARE_DIR)
      await clickByText('.fixed.z-50 button', M.compare.run)
      await sleep(3000)
      await dismissToasts()
      await shot('07d-compare')
      console.log(`[smoke] compare rows: ${await js(`document.querySelectorAll('.fixed.z-50 tbody tr').length`)}`)
      await escape()
      await sleep(300)
      fs.rmSync(COMPARE_DIR, { recursive: true, force: true })

      // Batch rename: select two rows and open it from the context menu
      await js(
        `(() => { const rows = [...document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row')]; const a = rows.find((r) => r.textContent.includes('cybercat-demo.log')); const b = rows.find((r) => r.textContent.includes('sshd.pid')); if (!a || !b) return false; a.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: true })); return true })()`
      )
      await sleep(300)
      await openMenu('sshd.pid')
      await sleep(400)
      await clickByText('.fixed.z-\\[71\\] button', M.pane.batchRename)
      await sleep(600)
      await setInput('.fixed.z-50 input.input-mono', 'ssh')
      await sleep(200)
      await setInput('.fixed.z-50 input.input-mono:nth-of-type(1)', 'ssh')
      await shot('07e-mass-rename')
      await escape()
      await sleep(300)

      // Docker view
      await click(byTitle('Docker (Ctrl+Shift+D)'))
      await sleep(4000)
      const dockerState = await js(
        `(() => { const t = document.body.innerText; return t.includes(${JSON.stringify(M.docker.notFound)}) ? 'absent' : t.includes(${JSON.stringify(M.docker.notAccessible)}) ? 'denied' : 'ok' })()`
      )
      console.log(`[smoke] docker view state: ${dockerState}`)
      if (dockerState === 'denied') {
        await clickByText('.flex-1 button', M.docker.enableSudo)
        await sleep(900)
        await setInput('.fixed.z-50 input[type=password]', PASS)
        await clickByText('.fixed.z-50 button', M.common.continue)
        await sleep(6000)
      }
      await shot('07f-docker')
      console.log(`[smoke] docker containers rows: ${await js(`document.querySelectorAll(${JSON.stringify(byTitle(M.docker.details))}).length`)}`)
      const inspectBtn = await click(byTitle(M.docker.details))
      if (inspectBtn) {
        await sleep(2500)
        await shot('07g-docker-inspect')
        await escape()
        await sleep(300)
      }
      await click(byTitle('Docker (Ctrl+Shift+D)'))
      await sleep(400)
      if (dockerState === 'denied') {
        await click(byTitle(M.pane.sudoOff))
        await sleep(600)
      }

      // Transfers panel
      await click(byTitle(M.titleBar.transfers))
      await sleep(600)
      await shot('08-transfers')
      await click(byTitle(M.transfers.collapse))

      // Settings
      await click(byTitle(M.titleBar.settings))
      await sleep(600)
      await shot('09-settings')
      await escape()
      await sleep(300)
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F1' })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F1' })
      await sleep(600)
      await shot('09b-shortcuts')
      await escape()
      await sleep(300)

      // ssh config import on the home tab
      await clickByText('header nav button', M.titleBar.connections)
      await sleep(400)
      await click(byTitle(M.home.importSshConfig))
      await sleep(1500)
      await shot('10-ssh-import')
      console.log(`[smoke] ssh config hosts listed: ${await js(`document.querySelectorAll('.fixed.z-50 label input[type=checkbox]').length`)}`)
      await escape()
      await sleep(300)

      // Light theme via the title bar button, on the home tab and in the session
      await click(byTitle(M.titleBar.lightTheme))
      await sleep(1000)
      await shot('11-light')
      await js(`document.querySelectorAll('header nav button')[1].click()`)
      await sleep(800)
      await shot('11b-light-session')
      await click(byTitle(M.titleBar.darkTheme))
      await sleep(400)

      // Small window: secondary file columns give way to the name
      const [w0, h0] = win.getSize()
      win.setSize(1000, 680)
      await sleep(900)
      await shot('11c-narrow')
      win.setSize(w0, h0)
      await sleep(600)
      await clickByText('header nav button', M.titleBar.connections)
      await sleep(300)

      // Language switch in Settings: the UI and main-process messages follow without a restart
      const other = LANG === 'en' ? 'uk' : 'en'
      const O = i18n.getMessages(other)
      const label = (lang) => i18n.LANGUAGES.find((l) => l.value === lang).label
      const navText = () => js(`document.querySelector('header nav button').textContent.trim()`)
      const mainMessage = () => js(`window.api.search.run({ target: ${JSON.stringify(info.id)}, root: '/' }).then(() => '', (e) => e.message)`)
      await click(byTitle(M.titleBar.settings))
      await sleep(500)
      await clickByText('.fixed.z-50 button', label(other))
      await sleep(700)
      await shot(`12-settings-${other}`)
      const switchedNav = await navText()
      const switchedMain = await mainMessage()
      console.log(
        `[smoke] switched to ${other}: title bar ${switchedNav === O.titleBar.connections ? 'ok' : `FAIL ("${switchedNav}")`}, main process ${switchedMain === O.main.search.nothingToFind ? 'ok' : `FAIL ("${switchedMain}")`}`
      )
      await clickByText('.fixed.z-50 button', label(LANG))
      await sleep(500)
      const restoredNav = await navText()
      console.log(`[smoke] switched back to ${LANG}: ${restoredNav === M.titleBar.connections ? 'ok' : `FAIL ("${restoredNav}")`}`)
      await escape()
      await sleep(300)
      console.log('[smoke] done')
    } catch (e) {
      console.error('[smoke] failed:', e)
    } finally {
      // remove the demo files
      if (info) {
        await js(
          `window.api.fs.remove(${JSON.stringify(info.id)}, [{ path: ${JSON.stringify(`${info.homeDir}/cybercat-demo.log`)}, isDir: false }, { path: ${JSON.stringify(`${info.homeDir}/docker-compose.yml`)}, isDir: false }])`
        ).catch(() => {})
      }
      fs.rmSync(DEMO_DIR, { recursive: true, force: true })
      fs.rmSync(COMPARE_DIR, { recursive: true, force: true })
      await sleep(300)
      app.exit(0)
    }
  })
}
