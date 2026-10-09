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
  const clickByText = (selector, text) =>
    js(
      `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true })()`
    )
  const escape = () => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  const remoteRow = (contains) =>
    `[...document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row')].find((r) => r.textContent.includes(${JSON.stringify(contains)}))`
  const setInput = (selector, value) =>
    js(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`
    )

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
      await sleep(3500)
      await shot('02-session')
      console.log(`[smoke] remote rows visible: ${await js(`document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row').length`)}`)

      // Термінал через Ctrl+`
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: '`', modifiers: ['control'] })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: '`', modifiers: ['control'] })
      await sleep(3000)
      await shot('03-terminal')

      // Контекстне меню на рядку панелі сервера
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

      // Відкрити файл у редакторі подвійним кліком
      const opened = await js(
        `(() => { const el = ${remoteRow('sshd.pid')}; if (!el) return false; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); return true })()`
      )
      await sleep(3000)
      await shot('05-editor')
      console.log(`[smoke] editor opened: ${opened}, monaco present: ${await js(`!!document.querySelector('.monaco-editor')`)}`)
      await click('button[title="До файлів (Ctrl+E)"]')
      await sleep(500)

      // Живий перегляд логу: готуємо файл з рівнями, відкриваємо через контекстне меню
      const logPath = `${info.homeDir}/cybercat-demo.log`
      await js(
        `window.api.text.save({ target: ${JSON.stringify(info.id)}, path: ${JSON.stringify(logPath)}, content: ${JSON.stringify(
          [
            '2026-10-09 09:30:01 INFO  server started on :8080',
            '2026-10-09 09:30:02 DEBUG loading config from /etc/app.yml',
            '2026-10-09 09:30:05 WARN  cache miss ratio 0.42 above threshold',
            '2026-10-09 09:30:09 ERROR upstream timeout after 5000 ms (attempt 3)',
            '2026-10-09 09:30:10 INFO  retrying upstream connection',
            ''
          ].join('\n')
        )}, eol: 'LF', encoding: 'utf-8' })`
      )
      await js(`[...document.querySelectorAll('button[title="Оновити (Ctrl+R)"]')].pop().click()`)
      await sleep(1500)
      console.log(`[smoke] demo log row present: ${await js(`!!(${remoteRow('cybercat-demo.log')})`)}`)
      await openMenu('cybercat-demo.log')
      await sleep(400)
      const tailClicked = await clickByText('.fixed.z-\\[71\\] button', 'Стежити за логом')
      await sleep(2500)
      // дописуємо рядок, щоб перевірити live
      await js(
        `window.api.terminal.open(${JSON.stringify(info.id)}, 80, 24).then((t) => { window.api.terminal.write(t, 'echo "2026-10-09 09:30:15 ERROR disk /var 97% full" >> ${logPath}\\n'); setTimeout(() => window.api.terminal.close(t), 1500) })`
      )
      await sleep(2500)
      await shot('06-logview')
      console.log(`[smoke] log view opened: ${tailClicked}, live rows: ${await js(`document.querySelectorAll('.font-mono .h-5').length`)}`)
      await click('button[title="До файлів (Ctrl+E)"]')
      await sleep(400)

      // Пошук через Ctrl+Shift+F на панелі сервера
      await js(`document.querySelector('[id^="filelist-"][id$="-remote"]').focus()`)
      await js(
        `document.querySelector('[id^="filelist-"][id$="-remote"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true, bubbles: true }))`
      )
      await sleep(500)
      await setInput('input[placeholder="*.conf"]', 'ssh')
      await setInput('input[placeholder="listen 443"]', '')
      await clickByText('.fixed.z-50 button', 'Шукати')
      await sleep(2500)
      await shot('07-search')
      console.log(`[smoke] search results: ${await js(`document.querySelectorAll('.fixed.z-50 .group').length`)}`)
      await escape()
      await sleep(300)

      // sudo-режим: кнопка, діалог пароля, бейдж root
      await click('button[title^="sudo-режим"]')
      await sleep(900)
      await shot('07b-sudo-prompt')
      await setInput('.fixed.z-50 input[type=password]', PASS)
      await clickByText('.fixed.z-50 button', 'Продовжити')
      await sleep(2500)
      await shot('07c-sudo-active')
      console.log(`[smoke] sudo badge: ${await js(`!![...document.querySelectorAll('section span')].find((s) => s.textContent.trim() === 'root')`)}`)
      await click('button[title="Вимкнути sudo-режим"]')
      await sleep(800)

      // Порівняння тек з маленькою локальною текою
      const cmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cc-smoke-cmp-'))
      fs.writeFileSync(path.join(cmpDir, 'sshd.pid'), '198\n')
      fs.writeFileSync(path.join(cmpDir, 'local-only.txt'), 'hello')
      await click('button[title="Порівняти з локальною текою"]')
      await sleep(600)
      await setInput('.fixed.z-50 input.input-mono', cmpDir)
      await clickByText('.fixed.z-50 button', 'Порівняти')
      await sleep(3000)
      await shot('07d-compare')
      console.log(`[smoke] compare rows: ${await js(`document.querySelectorAll('.fixed.z-50 tbody tr').length`)}`)
      await escape()
      await sleep(300)
      fs.rmSync(cmpDir, { recursive: true, force: true })

      // Масове перейменування: виділяємо два рядки і відкриваємо з контекстного меню
      await js(
        `(() => { const rows = [...document.querySelectorAll('[id^="filelist-"][id$="-remote"] .file-row')]; const a = rows.find((r) => r.textContent.includes('cybercat-demo.log')); const b = rows.find((r) => r.textContent.includes('sshd.pid')); if (!a || !b) return false; a.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: true })); return true })()`
      )
      await sleep(300)
      await openMenu('sshd.pid')
      await sleep(400)
      await clickByText('.fixed.z-\\[71\\] button', 'Масове перейменування')
      await sleep(600)
      await setInput('.fixed.z-50 input.input-mono', 'ssh')
      await sleep(200)
      await setInput('.fixed.z-50 input.input-mono:nth-of-type(1)', 'ssh')
      await shot('07e-mass-rename')
      await escape()
      await sleep(300)

      // Docker-режим
      await click('button[title="Docker (Ctrl+Shift+D)"]')
      await sleep(4000)
      const dockerState = await js(`(() => { const t = document.body.innerText; return t.includes('Docker не знайдено') ? 'absent' : t.includes('Docker є, але недоступний') ? 'denied' : 'ok' })()`)
      console.log(`[smoke] docker view state: ${dockerState}`)
      if (dockerState === 'denied') {
        await clickByText('.flex-1 button', 'Увімкнути sudo-режим')
        await sleep(900)
        await setInput('.fixed.z-50 input[type=password]', PASS)
        await clickByText('.fixed.z-50 button', 'Продовжити')
        await sleep(6000)
      }
      await shot('07f-docker')
      console.log(`[smoke] docker containers rows: ${await js(`document.querySelectorAll('button[title="Деталі (inspect)"]').length`)}`)
      const inspectBtn = await click('button[title="Деталі (inspect)"]')
      if (inspectBtn) {
        await sleep(2500)
        await shot('07g-docker-inspect')
        await escape()
        await sleep(300)
      }
      await click('button[title="Docker (Ctrl+Shift+D)"]')
      await sleep(400)
      if (dockerState === 'denied') {
        await click('button[title="Вимкнути sudo-режим"]')
        await sleep(600)
      }

      // Панель передач
      await click('button[title="Передачі"]')
      await sleep(600)
      await shot('08-transfers')
      await click('button[title="Згорнути"]')

      // Налаштування
      await click('button[title="Налаштування (Ctrl+,)"]')
      await sleep(600)
      await shot('09-settings')
      await escape()
      await sleep(300)

      // Імпорт із ssh config на головній вкладці
      await clickByText('header nav button', 'Підключення')
      await sleep(400)
      await click('button[title="Імпорт із ~/.ssh/config"]')
      await sleep(1500)
      await shot('10-ssh-import')
      console.log(`[smoke] ssh config hosts listed: ${await js(`document.querySelectorAll('.fixed.z-50 label input[type=checkbox]').length`)}`)
      await escape()
      await sleep(300)

      // Світла тема через кнопку у заголовку
      await click('button[title="Світла тема"]')
      await sleep(1000)
      await shot('11-light')
      await click('button[title="Темна тема"]')
      await sleep(400)

      // прибираємо демо-лог
      await js(`window.api.fs.remove(${JSON.stringify(info.id)}, [{ path: ${JSON.stringify(logPath)}, isDir: false }])`).catch(() => {})
      console.log('[smoke] done')
    } catch (e) {
      console.error('[smoke] failed:', e)
    } finally {
      await sleep(300)
      app.exit(0)
    }
  })
}
