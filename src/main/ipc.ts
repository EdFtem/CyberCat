import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { homedir } from 'os'
import { sep, join } from 'path'
import { settings } from './store/settings'
import { profiles } from './store/profiles'
import { sessions } from './ssh/SessionManager'
import { getFs } from './fs'
import { openText, saveText } from './editor/TextEditor'
import { externalEditor } from './editor/ExternalEditor'
import { transfers } from './transfer/TransferManager'
import { terminals } from './terminal/TerminalService'
import { answerPrompt } from './prompter'
import type { AppInfo } from '@shared/api'
import type { AppSettings, ConnectRequest, Profile, SaveTextRequest, Target, TransferRequest } from '@shared/types'

type Handler = (...args: never[]) => unknown

/** Обгортка: повертає {ok,data} або {ok:false,error}, щоб renderer бачив чисте повідомлення */
function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      const data = await (fn as (...a: unknown[]) => unknown)(...args)
      return { ok: true, data }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: message }
    }
  })
}

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

export function registerIpc(): void {
  // ---- app
  handle('app:info', (): AppInfo => ({
    platform: process.platform,
    home: homedir(),
    version: app.getVersion(),
    sep
  }))
  handle('app:pickFile', async (opts?: { title?: string; defaultPath?: string }) => {
    const win = focusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      title: opts?.title ?? 'Оберіть файл',
      defaultPath: opts?.defaultPath ?? join(homedir(), '.ssh'),
      properties: ['openFile', 'showHiddenFiles']
    })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  handle('app:pickDirectory', async (opts?: { title?: string; defaultPath?: string }) => {
    const win = focusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      title: opts?.title ?? 'Оберіть теку',
      defaultPath: opts?.defaultPath ?? homedir(),
      properties: ['openDirectory']
    })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  handle('app:openPath', async (p: string) => {
    const err = await shell.openPath(p)
    if (err) throw new Error(err)
  })
  handle('app:showInFolder', (p: string) => shell.showItemInFolder(p))
  handle('app:setTitleBarOverlay', (o: { color: string; symbolColor: string }) => {
    const win = focusedWindow()
    try {
      win?.setTitleBarOverlay?.({ color: o.color, symbolColor: o.symbolColor, height: 40 })
    } catch {
      /* не підтримується на цій платформі */
    }
  })

  // ---- settings
  handle('settings:get', () => settings.get())
  handle('settings:set', (patch: Partial<AppSettings>) => settings.set(patch))

  // ---- profiles
  handle('profiles:list', () => profiles.list())
  handle('profiles:save', (p: Profile, password?: string | null) => profiles.save(p, password))
  handle('profiles:remove', (id: string) => profiles.remove(id))

  // ---- sessions
  handle('session:connect', (req: ConnectRequest) => sessions.connect(req))
  handle('session:disconnect', (id: string) => sessions.disconnect(id))
  handle('session:remove', (id: string) => sessions.remove(id))
  handle('session:list', () => sessions.list())

  // ---- fs
  handle('fs:list', async (target: Target, path: string) => {
    const fs = getFs(target)
    const entries = await fs.list(path)
    return { path, entries }
  })
  handle('fs:stat', (target: Target, path: string) => getFs(target).stat(path))
  handle('fs:mkdir', (target: Target, path: string) => getFs(target).mkdir(path))
  handle('fs:createFile', (target: Target, path: string) => getFs(target).createFile(path))
  handle('fs:rename', (target: Target, from: string, to: string) => getFs(target).rename(from, to))
  handle('fs:remove', async (target: Target, items: { path: string; isDir: boolean }[]) => {
    const fs = getFs(target)
    const errors: string[] = []
    for (const it of items) {
      try {
        await fs.remove(it.path, it.isDir)
      } catch (e) {
        errors.push(`${fs.basename(it.path)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (errors.length) throw new Error(errors.join('\n'))
  })
  handle('fs:chmod', async (target: Target, paths: string[], mode: number, recursive: boolean) => {
    const fs = getFs(target)
    const errors: string[] = []
    for (const p of paths) {
      try {
        await fs.chmod(p, mode, recursive)
      } catch (e) {
        errors.push(`${fs.basename(p)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (errors.length) throw new Error(errors.join('\n'))
  })
  handle('fs:home', (target: Target) => getFs(target).home())
  handle('fs:realpath', (target: Target, path: string) => getFs(target).realpath(path))
  handle('fs:diskUsage', (target: Target, path: string) => getFs(target).diskUsage(path))

  // ---- text editor
  handle('text:open', (target: Target, path: string) => openText(target, path))
  handle('text:save', (req: SaveTextRequest) => saveText(req))

  // ---- transfers
  handle('transfer:enqueue', (req: TransferRequest) => transfers.enqueue(req))
  handle('transfer:list', () => transfers.summary())
  handle('transfer:pause', (id: string) => transfers.pause(id))
  handle('transfer:resume', (id: string) => transfers.resume(id))
  handle('transfer:cancel', (id: string) => transfers.cancel(id))
  handle('transfer:retry', (id: string) => transfers.retry(id))
  handle('transfer:remove', (id: string) => transfers.remove(id))
  handle('transfer:clearFinished', () => transfers.clearFinished())
  handle('transfer:cancelAll', () => transfers.cancelAll())

  // ---- external editor
  handle('extedit:open', (sessionId: string, path: string) => externalEditor.open(sessionId, path))
  handle('extedit:close', (id: string) => externalEditor.close(id))
  handle('extedit:list', () => externalEditor.list())
  handle('extedit:uploadNow', (id: string) => externalEditor.upload(id))

  // ---- terminal
  handle('terminal:open', (sessionId: string, cols: number, rows: number, cwd?: string) =>
    terminals.open(sessionId, cols, rows, cwd)
  )
  ipcMain.on('terminal:write', (_e, termId: string, data: string) => terminals.write(termId, data))
  ipcMain.on('terminal:resize', (_e, termId: string, cols: number, rows: number) =>
    terminals.resize(termId, cols, rows)
  )
  handle('terminal:close', (termId: string) => terminals.close(termId))

  // ---- prompts
  handle('prompt:answer', (id: string, answer: unknown) => answerPrompt(id, answer))
}
