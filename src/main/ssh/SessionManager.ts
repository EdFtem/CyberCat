import { randomUUID } from 'crypto'
import { Session } from './Session'
import { S3Session } from '../s3/S3Session'
import { broadcast } from '../broadcast'
import { bus } from '../bus'
import { profiles } from '../store/profiles'
import { tr } from '../i18n'
import type { ConnectRequest, Profile, SessionInfo } from '@shared/types'

/** An open connection: SSH, or S3 (files only: no shell, terminal, Docker or tunnels) */
export type AnySession = Session | S3Session

class SessionManager {
  private sessions = new Map<string, AnySession>()

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.info)
  }

  get(id: string): AnySession | undefined {
    return this.sessions.get(id)
  }

  require(id: string): AnySession {
    const s = this.sessions.get(id)
    if (!s) throw new Error(tr().main.session.notFound)
    return s
  }

  /** For features that need SSH itself: shell, terminal, sudo, Docker, tunnels */
  requireSsh(id: string): Session {
    const s = this.require(id)
    if (!(s instanceof Session)) throw new Error(tr().main.s3.notSupported)
    return s
  }

  /** The SSH session, or undefined for a missing or S3 one */
  getSsh(id: string): Session | undefined {
    const s = this.sessions.get(id)
    return s instanceof Session ? s : undefined
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
    const session: AnySession = profile.kind === 's3' ? new S3Session(id, profile) : new Session(id, profile)
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
