import { randomUUID } from 'crypto'
import { Session } from './Session'
import { broadcast } from '../broadcast'
import { bus } from '../bus'
import { profiles } from '../store/profiles'
import { tr } from '../i18n'
import type { ConnectRequest, Profile, SessionInfo } from '@shared/types'

class SessionManager {
  private sessions = new Map<string, Session>()

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.info)
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  require(id: string): Session {
    const s = this.sessions.get(id)
    if (!s) throw new Error(tr().main.session.notFound)
    return s
  }

  async connect(req: ConnectRequest): Promise<SessionInfo> {
    if (req.sessionId) {
      const existing = this.require(req.sessionId)
      await existing.connect(req.password)
      return existing.info
    }

    let profile: Profile
    if (req.profileId) {
      const p = profiles.get(req.profileId)
      if (!p) throw new Error(tr().main.session.profileNotFound)
      profile = p
      profiles.touch(p.id)
    } else if (req.adHoc) {
      profile = { ...req.adHoc, id: '', createdAt: Date.now() }
    } else {
      throw new Error(tr().main.session.noProfile)
    }

    const id = randomUUID()
    const session = new Session(id, profile)
    session.on('update', (info: SessionInfo) => {
      broadcast('session:update', info)
      bus.emit('session:update', info)
    })
    session.on('reconnected', () => {
      broadcast('session:reconnected', id)
      bus.emit('session:reconnected', id)
    })
    this.sessions.set(id, session)
    broadcast('session:update', session.info)

    // The session stays in the list with the error status so the user can see why
    await session.connect(req.password)
    return session.info
  }

  disconnect(id: string): void {
    this.sessions.get(id)?.disconnect()
  }

  remove(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    s.disconnect()
    s.removeAllListeners()
    this.sessions.delete(id)
    bus.emit('session:removed', id)
  }

  disconnectAll(): void {
    for (const s of this.sessions.values()) s.disconnect()
  }
}

export const sessions = new SessionManager()
