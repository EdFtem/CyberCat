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
import { importSshHosts, listSshConfigHosts } from './ssh/sshConfig'
import { tails } from './tail/TailService'
import { runSearch } from './search/SearchService'
import { runCompare } from './sync/CompareService'
import { watches } from './sync/WatchService'
import * as docker from './docker/DockerService'
import { tunnels } from './tunnel/TunnelService'
import type { AppInfo } from '@shared/api'
import type {
  AppSettings,
  CompareRequest,
  ConnectRequest,
  DockerContainerAction,
  Profile,
  SaveTextRequest,
  SearchRequest,
  Target,
  TransferRequest
} from '@shared/types'

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
  handle('app:openExternal', async (url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('Дозволено лише http(s) посилання')
    await shell.openExternal(url)
  })
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
  handle('session:sudo', async (id: string, enable: boolean) => {
    const s = sessions.require(id)
    if (enable) await s.enableSudo()
    else s.disableSudo()
    return s.info
  })
  handle('session:exec', (id: string, cmd: string) => sessions.require(id).exec(cmd, 300_000))

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
  handle('fs:copy', async (target: Target, items: { path: string; name: string; isDir: boolean }[], destDir: string) => {
    const fs = getFs(target)
    const errors: string[] = []
    for (const it of items) {
      try {
        await fs.copy(it.path, fs.join(destDir, it.name))
      } catch (e) {
        errors.push(`${it.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (errors.length) throw new Error(errors.join('\n'))
  })
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
  handle('terminal:open', (sessionId: string, cols: number, rows: number, cwd?: string, command?: string) =>
    terminals.open(sessionId, cols, rows, cwd, command)
  )
  ipcMain.on('terminal:write', (_e, termId: string, data: string) => terminals.write(termId, data))
  ipcMain.on('terminal:resize', (_e, termId: string, cols: number, rows: number) =>
    terminals.resize(termId, cols, rows)
  )
  handle('terminal:close', (termId: string) => terminals.close(termId))

  // ---- prompts
  handle('prompt:answer', (id: string, answer: unknown) => answerPrompt(id, answer))

  // ---- ssh config
  handle('sshconfig:list', () => listSshConfigHosts())
  handle('sshconfig:import', (aliases: string[]) => importSshHosts(aliases))

  // ---- tail
  handle('tail:start', (target: Target, path: string, lines?: number) => tails.start(target, path, lines))
  handle('tail:snapshot', (id: string) => tails.snapshot(id))
  handle('tail:stop', (id: string) => tails.stop(id))

  // ---- search
  handle('search:run', (req: SearchRequest) => runSearch(req))

  // ---- compare / watch
  handle('compare:run', (req: CompareRequest) => runCompare(req))
  handle('watch:start', (sid: string, l: string, r: string) => watches.start(sid, l, r))
  handle('watch:stop', (id: string) => watches.stop(id))
  handle('watch:list', () => watches.list())

  // ---- docker
  handle('docker:detect', (sid: string, force?: boolean) => docker.detectDocker(sid, !!force))
  handle('docker:containers', (sid: string) => docker.listContainers(sid))
  handle('docker:action', (sid: string, id: string, action: DockerContainerAction, force?: boolean) => docker.containerAction(sid, id, action, !!force))
  handle('docker:inspect', (sid: string, id: string) => docker.inspectContainer(sid, id))
  handle('docker:images', (sid: string) => docker.listImages(sid))
  handle('docker:imageAction', (sid: string, id: string, action: 'rm' | 'pull', force?: boolean) => docker.imageAction(sid, id, action, !!force))
  handle('docker:volumes', (sid: string) => docker.listVolumes(sid))
  handle('docker:volumeAction', (sid: string, name: string, action: 'rm', force?: boolean) => docker.volumeAction(sid, name, action, !!force))
  handle('docker:diskUsage', (sid: string) => docker.diskUsage(sid))
  handle('docker:prune', (sid: string, what: 'images' | 'volumes' | 'containers' | 'system') => docker.prune(sid, what))
  handle('docker:logs', async (sid: string, id: string, tail = 300) => tails.startCommand(sid, await docker.logsCommand(sid, id, tail)))
  handle('docker:shellCommand', (sid: string, id: string) => docker.execShellCommand(sid, id))
  handle('docker:composeCommand', (sid: string, project: string, dir: string | undefined, files: string[] | undefined, action: string) =>
    docker.composeCommand(sid, project, dir, files, action)
  )

  // ---- tunnels
  handle('tunnel:start', (sid: string, host: string, port: number) => tunnels.start(sid, host, port))
  handle('tunnel:stop', (id: string) => tunnels.stop(id))
  handle('tunnel:list', () => tunnels.list())
}
