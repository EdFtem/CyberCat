/**
 * Smoke-перевірка UI: робить знімки екрана головного вікна і друкує діагностику.
 * Запуск: npm run test:ui (див. tests/run-ui-smoke.cjs).
 * Потрібен тестовий sshd (див. README) на 127.0.0.1:2222, користувач cat/catpass.
 */
const path = require('path')
const fs = require('fs')
const { createHash } = require('crypto')
const { Client } = require(path.join(process.cwd(), 'node_modules', 'ssh2'))

const HOST = process.env.CC_TEST_HOST || '127.0.0.1'
const PORT = Number(process.env.CC_TEST_PORT || 2222)
const USER = process.env.CC_TEST_USER || 'cat'
const PASS = process.env.CC_TEST_PASS || 'catpass'
const SHOTS = process.env.CYBERCAT_SHOTS || path.join(process.cwd(), 'out', 'shots')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

module.exports = ({ win, app }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f), { force: true })
  const shot = async (name) => {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(SHOTS, `${name}.png`), img.toPNG())
    console.log(`[smoke] shot ${name}`)
  }
  const js = (code) => win.webContents.executeJavaScript(code, true)
  const click = (selector) => js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
  const remoteRow = (contains) =>
    `[...document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row')].find((r) => r.textContent.includes(${JSON.stringify(contains)}))`

  win.webContents.once('did-finish-load', async () => {
    try {
      await sleep(1800)
      await shot('01-home')

      // Довірений ключ хоста, щоб не чекати діалогу
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
      const info = await js(
        `window.api.sessions.connect({ adHoc: { name: 'docker sshd', host: ${JSON.stringify(HOST)}, port: ${PORT}, username: ${JSON.stringify(USER)}, auth: 'password', savePassword: false, color: '#22d3ee' }, password: ${JSON.stringify(PASS)} })`
      )
      console.log(`[smoke] connected in ${Date.now() - t0} ms: status=${info && info.status} home=${info && info.homeDir} shell=${info && info.hasShell}`)
      const listProbe = await js(
        `window.api.fs.list(${JSON.stringify(info.id)}, ${JSON.stringify(info.homeDir || '/')}).then((r) => 'ok ' + r.entries.length, (e) => 'err ' + e.message)`
      )
      console.log(`[smoke] fs.list probe: ${listProbe}`)
      await sleep(3500)
      await shot('02-session')
      console.log(`[smoke] remote rows visible: ${await js(`document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row').length`)}`)

      // Термінал через Ctrl+`
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: '`', modifiers: ['control'] })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: '`', modifiers: ['control'] })
      await sleep(3000)
      await shot('03-terminal')

      // Контекстне меню на рядку панелі сервера
      const hadMenu = await js(
        `(() => { const el = ${remoteRow('sshd.pid')} || document.querySelector('[id^="filelist-"][id$="-remote"] .file-row'); if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 80, clientY: r.top + 14, button: 2 })); return true })()`
      )
      await sleep(600)
      await shot('04-context-menu')
      console.log(`[smoke] context menu dispatched: ${hadMenu}, visible: ${await js(`!!document.querySelector('.fixed.z-\\\\[71\\\\]')`)}`)
      await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
      await sleep(300)

      // Відкрити файл у редакторі подвійним кліком
      const opened = await js(
        `(() => { const el = ${remoteRow('sshd.pid')}; if (!el) return false; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); return true })()`
      )
      await sleep(3000)
      await shot('05-editor')
      console.log(`[smoke] editor opened: ${opened}, monaco present: ${await js(`!!document.querySelector('.monaco-editor')`)}`)
      await click('button[title="До файлів (Ctrl+E)"]')
      await sleep(500)

      // Панель передач
      await click('button[title="Передачі"]')
      await sleep(600)
      await shot('06-transfers')
      await click('button[title="Згорнути"]')

      // Налаштування
      await click('button[title="Налаштування (Ctrl+,)"]')
      await sleep(600)
      await shot('07-settings')
      await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
      await sleep(300)

      // Світла тема через кнопку у заголовку
      await click('button[title="Світла тема"]')
      await sleep(1000)
      const colors = await js(
        `(() => { const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : 'n/a' }; return { theme: document.documentElement.dataset.theme, body: getComputedStyle(document.body).backgroundColor, header: cs('header'), pane: cs('section') } })()`
      )
      console.log('[smoke] light theme computed:', JSON.stringify(colors))
      await shot('08-light')
      await click('button[title="Темна тема"]')
      await sleep(400)

      console.log('[smoke] done')
    } catch (e) {
      console.error('[smoke] failed:', e)
    } finally {
      await sleep(300)
      app.exit(0)
    }
  })
}
