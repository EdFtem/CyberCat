import { randomUUID, createHash } from 'crypto'
import { promises as fsp, watchFile, unwatchFile } from 'fs'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import { spawn } from 'child_process'
import { shell } from 'electron'
import { broadcast, toast } from '../broadcast'
import { bus } from '../bus'
import { sessions } from '../ssh/SessionManager'
import { RemoteFs } from '../fs/RemoteFs'
import { settings } from '../store/settings'
import { tr } from '../i18n'
import type { ExternalEdit } from '@shared/types'

const MAX_EXTERNAL_BYTES = 200 * 1024 * 1024

interface Edit extends ExternalEdit {
  debounce?: NodeJS.Timeout
  busy: boolean
  pending: boolean
  lastMtime: number
  lastSize: number
}

function launchEditor(command: string, file: string): void {
  const cmd = command.trim()
  if (!cmd) {
    void shell.openPath(file)
    return
  }
  const quoted = `"${file}"`
  const line = cmd.includes('%f') ? cmd.replace(/%f/g, quoted) : `${cmd} ${quoted}`
  const child = spawn(line, { shell: true, detached: true, stdio: 'ignore', windowsHide: false })
  child.on('error', (e) => toast('error', tr().main.editor.launchFailed, e.message))
  child.unref()
}

class ExternalEditorService {
  private edits = new Map<string, Edit>()

  constructor() {
    bus.on('session:removed', (id: string) => {
      for (const e of [...this.edits.values()]) if (e.sessionId === id) void this.close(e.id)
    })
  }

  list(): ExternalEdit[] {
    return [...this.edits.values()].map(({ debounce: _d, busy: _b, pending: _p, lastMtime: _m, lastSize: _s, ...pub }) => pub)
  }

  private emit(): void {
    broadcast('extedit:update', this.list())
  }

  async open(sessionId: string, remotePath: string): Promise<ExternalEdit> {
    const session = sessions.require(sessionId)
    const existing = [...this.edits.values()].find((e) => e.sessionId === sessionId && e.remotePath === remotePath)
    if (existing) {
      launchEditor(settings.get().externalEditor, existing.localPath)
      return existing
    }

    const remote = new RemoteFs(session)
    const hash = createHash('sha1').update(`${session.info.host}:${remotePath}`).digest('hex').slice(0, 10)
    const dir = join(tmpdir(), 'cybercat', hash)
    await fsp.mkdir(dir, { recursive: true })
    const localPath = join(dir, basename(remotePath))

    const edit: Edit = {
      id: randomUUID(),
      sessionId,
      remotePath,
      localPath,
      name: basename(remotePath),
      status: 'downloading',
      uploads: 0,
      busy: false,
      pending: false,
      lastMtime: 0,
      lastSize: 0
    }
    this.edits.set(edit.id, edit)
    this.emit()

    try {
      const st = await remote.stat(remotePath)
      if (st.size > MAX_EXTERNAL_BYTES) throw new Error(tr().main.editor.tooLarge)
      const { data } = await remote.readFile(remotePath)
      await fsp.writeFile(localPath, data)
      const lst = await fsp.stat(localPath)
      edit.lastMtime = lst.mtimeMs
      edit.lastSize = lst.size
      edit.status = 'watching'
      this.emit()

      watchFile(localPath, { interval: 600 }, (cur) => {
        if (cur.mtimeMs === edit.lastMtime && cur.size === edit.lastSize) return
        if (cur.nlink === 0) return
        edit.lastMtime = cur.mtimeMs
        edit.lastSize = cur.size
        this.scheduleUpload(edit)
      })

      launchEditor(settings.get().externalEditor, localPath)
      return this.list().find((e) => e.id === edit.id)!
    } catch (e) {
      edit.status = 'error'
      edit.error = e instanceof Error ? e.message : String(e)
      this.emit()
      throw e
    }
  }

  private scheduleUpload(edit: Edit): void {
    if (edit.debounce) clearTimeout(edit.debounce)
    edit.debounce = setTimeout(() => void this.upload(edit.id), 400)
  }

  async upload(id: string): Promise<void> {
    const edit = this.edits.get(id)
    if (!edit) return
    if (edit.busy) {
      edit.pending = true
      return
    }
    edit.busy = true
    edit.status = 'uploading'
    edit.error = undefined
    this.emit()
    try {
      const session = sessions.require(edit.sessionId)
      const remote = new RemoteFs(session)
      const data = await fsp.readFile(edit.localPath)
      await remote.writeFileAtomic(edit.remotePath, data)
      edit.uploads++
      edit.lastUpload = Date.now()
      edit.status = 'watching'
    } catch (e) {
      edit.status = 'error'
      edit.error = e instanceof Error ? e.message : String(e)
      toast('error', tr().main.editor.uploadFailed(edit.name), edit.error)
    } finally {
      edit.busy = false
      this.emit()
      if (edit.pending) {
        edit.pending = false
        this.scheduleUpload(edit)
      }
    }
  }

  async close(id: string): Promise<void> {
    const edit = this.edits.get(id)
    if (!edit) return
    if (edit.debounce) clearTimeout(edit.debounce)
    unwatchFile(edit.localPath)
    this.edits.delete(id)
    await fsp.rm(edit.localPath, { force: true }).catch(() => {})
    this.emit()
  }

  async closeAll(): Promise<void> {
    for (const id of [...this.edits.keys()]) await this.close(id)
  }
}

export const externalEditor = new ExternalEditorService()
