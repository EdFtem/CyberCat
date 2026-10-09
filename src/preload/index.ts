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
    list: () => call('session:list')
  },
  fs: {
    list: (t, p) => call('fs:list', t, p),
    stat: (t, p) => call('fs:stat', t, p),
    mkdir: (t, p) => call('fs:mkdir', t, p),
    createFile: (t, p) => call('fs:createFile', t, p),
    rename: (t, a, b) => call('fs:rename', t, a, b),
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
    open: (sessionId, cols, rows, cwd) => call('terminal:open', sessionId, cols, rows, cwd),
    write: (termId, data) => ipcRenderer.send('terminal:write', termId, data),
    resize: (termId, cols, rows) => ipcRenderer.send('terminal:resize', termId, cols, rows),
    close: (termId) => call('terminal:close', termId)
  },
  prompt: {
    answer: (id, answer) => call('prompt:answer', id, answer)
  },
  on: {
    sessionUpdate: (cb) => on('session:update', cb),
    sessionReconnected: (cb) => on('session:reconnected', cb),
    transferUpdate: (cb) => on('transfer:update', cb),
    exteditUpdate: (cb) => on('extedit:update', cb),
    terminalData: (cb) => on('terminal:data', cb),
    terminalExit: (cb) => on('terminal:exit', cb),
    promptRequest: (cb) => on('prompt:request', cb),
    toast: (cb) => on('toast', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
