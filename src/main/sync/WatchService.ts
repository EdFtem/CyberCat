import { randomUUID } from 'crypto'
import { promises as fsp, watch, type FSWatcher } from 'fs'
import { basename, join } from 'path'
import { posix } from 'path'
import { broadcast, toast } from '../broadcast'
import { bus } from '../bus'
import { sessions } from '../ssh/SessionManager'
import { RemoteFs } from '../fs'
import { transfers } from '../transfer/TransferManager'
import type { WatchInfo } from '@shared/types'

const DEBOUNCE_MS = 700
const IGNORE = /(^|[\\/])(\.git|node_modules|\.DS_Store|Thumbs\.db)([\\/]|$)|\.cc-tmp$|\.swp$|\.tmp$|~$/i

interface Watch {
  info: WatchInfo
  watcher: FSWatcher
  timers: Map<string, NodeJS.Timeout>
}

/** Режим «тримати в актуальному стані»: зміни у локальній теці автоматично відвантажуються */
class WatchService {
  private watches = new Map<string, Watch>()

  constructor() {
    bus.on('session:removed', (id: string) => this.stopForSession(id))
  }

  list(): WatchInfo[] {
    return [...this.watches.values()].map((w) => w.info)
  }

  private emit(): void {
    broadcast('watch:update', this.list())
  }

  start(sessionId: string, localDir: string, remoteDir: string): WatchInfo {
    sessions.require(sessionId)
    for (const w of this.watches.values()) {
      if (w.info.sessionId === sessionId && w.info.localDir === localDir && w.info.remoteDir === remoteDir) return w.info
    }
    const info: WatchInfo = { id: randomUUID(), sessionId, localDir, remoteDir, events: 0, status: 'active' }
    const timers = new Map<string, NodeJS.Timeout>()
    let watcher: FSWatcher
    try {
      watcher = watch(localDir, { recursive: true }, (_event, filename) => {
        if (!filename) return
        const rel = filename.toString()
        if (IGNORE.test(rel)) return
        const prev = timers.get(rel)
        if (prev) clearTimeout(prev)
        timers.set(
          rel,
          setTimeout(() => {
            timers.delete(rel)
            void this.handle(info, rel)
          }, DEBOUNCE_MS)
        )
      })
    } catch (e) {
      throw new Error(`Не вдалося стежити за текою: ${e instanceof Error ? e.message : String(e)}`)
    }
    watcher.on('error', (e) => {
      info.status = 'error'
      info.error = e.message
      this.emit()
    })
    this.watches.set(info.id, { info, watcher, timers })
    this.emit()
    toast('info', 'Стеження увімкнено', `${localDir} → ${remoteDir}`)
    return info
  }

  private async handle(info: WatchInfo, rel: string): Promise<void> {
    const full = join(info.localDir, rel)
    let st
    try {
      st = await fsp.stat(full)
    } catch {
      return // видалено або тимчасовий файл
    }
    const relPosix = rel.split(/[\\/]/).join('/')
    const remoteParent = posix.join(info.remoteDir, posix.dirname(relPosix) === '.' ? '' : posix.dirname(relPosix))
    try {
      if (st.isDirectory()) {
        await new RemoteFs(sessions.require(info.sessionId)).ensureDir(posix.join(info.remoteDir, relPosix))
      } else {
        await transfers.enqueue({
          sessionId: info.sessionId,
          direction: 'upload',
          sources: [{ path: full, name: basename(full), isDir: false }],
          destDir: remoteParent,
          policy: 'overwrite'
        })
      }
      info.events++
      info.lastEvent = Date.now()
      info.status = 'active'
      info.error = undefined
    } catch (e) {
      info.status = 'error'
      info.error = e instanceof Error ? e.message : String(e)
    }
    this.emit()
  }

  stop(id: string): void {
    const w = this.watches.get(id)
    if (!w) return
    this.watches.delete(id)
    for (const t of w.timers.values()) clearTimeout(t)
    try {
      w.watcher.close()
    } catch {
      /* ignore */
    }
    this.emit()
  }

  stopForSession(sessionId: string): void {
    for (const w of [...this.watches.values()]) if (w.info.sessionId === sessionId) this.stop(w.info.id)
  }

  stopAll(): void {
    for (const id of [...this.watches.keys()]) this.stop(id)
  }
}

export const watches = new WatchService()
