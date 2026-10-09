import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api, Unsubscribe } from '@shared/api'

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: string
}

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as Envelope<T>
  if (!r || typeof r !== 'object') return r as T
  if (r.ok === false) throw new Error(r.error ?? 'Невідома помилка')
  return r.data as T
}

function on<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: Api = {
  app: {
    info: () => call('app:info'),
    pickFile: (opts) => call('app:pickFile', opts),
    pickDirectory: (opts) => call('app:pickDirectory', opts),
    openPath: (p) => call('app:openPath', p),
    openExternal: (url) => call('app:openExternal', url),
    showInFolder: (p) => call('app:showInFolder', p),
    setTitleBarOverlay: (o) => call('app:setTitleBarOverlay', o),
    getPathForFile: (f) => webUtils.getPathForFile(f)
  },
  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', patch)
  },
  profiles: {
    list: () => call('profiles:list'),
    save: (p, password) => call('profiles:save', p, password),
    remove: (id) => call('profiles:remove', id)
  },
  sessions: {
    connect: (req) => call('session:connect', req),
    disconnect: (id) => call('session:disconnect', id),
    remove: (id) => call('session:remove', id),
    list: () => call('session:list'),
    sudo: (id, enable) => call('session:sudo', id, enable),
    exec: (id, cmd) => call('session:exec', id, cmd)
  },
  fs: {
    list: (t, p) => call('fs:list', t, p),
    stat: (t, p) => call('fs:stat', t, p),
    mkdir: (t, p) => call('fs:mkdir', t, p),
    createFile: (t, p) => call('fs:createFile', t, p),
    rename: (t, a, b) => call('fs:rename', t, a, b),
    copy: (t, items, destDir) => call('fs:copy', t, items, destDir),
    remove: (t, items) => call('fs:remove', t, items),
    chmod: (t, paths, mode, recursive) => call('fs:chmod', t, paths, mode, recursive),
    home: (t) => call('fs:home', t),
    realpath: (t, p) => call('fs:realpath', t, p),
    diskUsage: (t, p) => call('fs:diskUsage', t, p)
  },
  text: {
    open: (t, p) => call('text:open', t, p),
    save: (req) => call('text:save', req)
  },
  transfer: {
    enqueue: (req) => call('transfer:enqueue', req),
    list: () => call('transfer:list'),
    pause: (id) => call('transfer:pause', id),
    resume: (id) => call('transfer:resume', id),
    cancel: (id) => call('transfer:cancel', id),
    retry: (id) => call('transfer:retry', id),
    remove: (id) => call('transfer:remove', id),
    clearFinished: () => call('transfer:clearFinished'),
    cancelAll: () => call('transfer:cancelAll')
  },
  extedit: {
    open: (sessionId, p) => call('extedit:open', sessionId, p),
    close: (id) => call('extedit:close', id),
    list: () => call('extedit:list'),
    uploadNow: (id) => call('extedit:uploadNow', id)
  },
  terminal: {
    open: (sessionId, cols, rows, cwd, command) => call('terminal:open', sessionId, cols, rows, cwd, command),
    write: (termId, data) => ipcRenderer.send('terminal:write', termId, data),
    resize: (termId, cols, rows) => ipcRenderer.send('terminal:resize', termId, cols, rows),
    close: (termId) => call('terminal:close', termId)
  },
  prompt: {
    answer: (id, answer) => call('prompt:answer', id, answer)
  },
  sshconfig: {
    list: () => call('sshconfig:list'),
    import: (aliases) => call('sshconfig:import', aliases)
  },
  tail: {
    start: (target, p, lines) => call('tail:start', target, p, lines),
    snapshot: (tailId) => call('tail:snapshot', tailId),
    stop: (tailId) => call('tail:stop', tailId)
  },
  search: {
    run: (req) => call('search:run', req)
  },
  compare: {
    run: (req) => call('compare:run', req)
  },
  watch: {
    start: (sid, l, r) => call('watch:start', sid, l, r),
    stop: (id) => call('watch:stop', id),
    list: () => call('watch:list')
  },
  docker: {
    detect: (sid, force) => call('docker:detect', sid, force),
    containers: (sid) => call('docker:containers', sid),
    action: (sid, id, action, force) => call('docker:action', sid, id, action, force),
    inspect: (sid, id) => call('docker:inspect', sid, id),
    images: (sid) => call('docker:images', sid),
    imageAction: (sid, id, action, force) => call('docker:imageAction', sid, id, action, force),
    volumes: (sid) => call('docker:volumes', sid),
    volumeAction: (sid, name, action, force) => call('docker:volumeAction', sid, name, action, force),
    diskUsage: (sid) => call('docker:diskUsage', sid),
    prune: (sid, what) => call('docker:prune', sid, what),
    logs: (sid, id, tail) => call('docker:logs', sid, id, tail),
    shellCommand: (sid, id) => call('docker:shellCommand', sid, id),
    composeCommand: (sid, project, dir, files, action) => call('docker:composeCommand', sid, project, dir, files, action)
  },
  tunnel: {
    start: (sid, host, port) => call('tunnel:start', sid, host, port),
    stop: (id) => call('tunnel:stop', id),
    list: () => call('tunnel:list')
  },
  on: {
    sessionUpdate: (cb) => on('session:update', cb),
    sessionReconnected: (cb) => on('session:reconnected', cb),
    transferUpdate: (cb) => on('transfer:update', cb),
    exteditUpdate: (cb) => on('extedit:update', cb),
    terminalData: (cb) => on('terminal:data', cb),
    terminalExit: (cb) => on('terminal:exit', cb),
    promptRequest: (cb) => on('prompt:request', cb),
    toast: (cb) => on('toast', cb),
    tailData: (cb) => on('tail:data', cb),
    tailExit: (cb) => on('tail:exit', cb),
    watchUpdate: (cb) => on('watch:update', cb),
    tunnelUpdate: (cb) => on('tunnel:update', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
