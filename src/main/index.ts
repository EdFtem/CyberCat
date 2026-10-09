import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import { join, resolve } from 'path'

// Окрема тека даних для тестів або портативного режиму; має бути встановлена до читання сховищ
if (process.env.CYBERCAT_USER_DATA) app.setPath('userData', resolve(process.env.CYBERCAT_USER_DATA))

import { registerIpc } from './ipc'
import { sessions } from './ssh/SessionManager'
import { terminals } from './terminal/TerminalService'
import { externalEditor } from './editor/ExternalEditor'
import { transfers } from './transfer/TransferManager'
import { tails } from './tail/TailService'
import { rejectAllPrompts } from './prompter'
import { settings } from './store/settings'

const THEME_BG = { dark: '#0b0f17', light: '#f3f5f9' }
const THEME_SYMBOL = { dark: '#cbd5e1', light: '#334155' }

function createWindow(): BrowserWindow {
  const theme = settings.get().theme
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    show: false,
    backgroundColor: THEME_BG[theme],
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: THEME_BG[theme],
      symbolColor: THEME_SYMBOL[theme],
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] renderer process gone:', details.reason, details.exitCode)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[main] did-fail-load:', code, desc, url)
  })
  if (process.env.CYBERCAT_DEBUG) {
    win.webContents.on('console-message', (event) => {
      console.log(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.setName('CyberCat')
nativeTheme.themeSource = settings.get().theme

app.whenReady().then(() => {
  registerIpc()
  const win = createWindow()

  // Хук для автоматизованих перевірок UI: скрипт отримує вікно та app
  if (process.env.CYBERCAT_DEBUG_SCRIPT) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const hook = require(resolve(process.env.CYBERCAT_DEBUG_SCRIPT)) as (ctx: { win: BrowserWindow; app: typeof app }) => void
      hook({ win, app })
    } catch (e) {
      console.error('[main] debug script failed:', e)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

let cleaning = false
app.on('before-quit', (e) => {
  if (cleaning) return
  cleaning = true
  e.preventDefault()
  rejectAllPrompts('Застосунок закривається')
  transfers.cancelAll()
  terminals.closeAll()
  tails.stopAll()
  externalEditor
    .closeAll()
    .catch(() => {})
    .finally(() => {
      sessions.disconnectAll()
      app.quit()
    })
})

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[main] unhandledRejection', err)
})
