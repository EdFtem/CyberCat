import { randomUUID } from 'crypto'
import type { ClientChannel } from 'ssh2'
import { broadcast } from '../broadcast'
import { bus } from '../bus'
import { sessions } from '../ssh/SessionManager'
import { shq } from '../fs/sftpUtil'

interface Term {
  stream: ClientChannel
  sessionId: string
}

const PROMPT_RE = /[$#>%] ?(\x1b\[[0-9;]*[A-Za-z])*\s*$/

class TerminalService {
  private terms = new Map<string, Term>()

  constructor() {
    bus.on('session:removed', (id: string) => this.closeForSession(id))
  }

  async open(sessionId: string, cols: number, rows: number, cwd?: string, command?: string): Promise<string> {
    const session = sessions.require(sessionId)
    const stream = await session.shell(Math.max(cols, 10), Math.max(rows, 2))
    const id = randomUUID()
    this.terms.set(id, { stream, sessionId })

    stream.on('data', (d: Buffer) => broadcast('terminal:data', { termId: id, data: d }))
    stream.stderr.on('data', (d: Buffer) => broadcast('terminal:data', { termId: id, data: d }))
    stream.on('close', () => {
      this.terms.delete(id)
      broadcast('terminal:exit', { termId: id })
    })
    stream.on('error', () => {
      /* handled via close */
    })

    if (cwd || command) {
      // Wait for the shell prompt so the command does not show up twice in the output.
      // A leading space keeps the command out of bash history with HISTCONTROL=ignorespace
      const cd = ` ${[cwd ? `cd ${shq(cwd)}` : '', command ?? ''].filter(Boolean).join(' && ')}\n`
      let sent = false
      const send = (): void => {
        if (sent) return
        sent = true
        stream.removeListener('data', onData)
        setTimeout(() => {
          if (this.terms.has(id)) stream.write(cd)
        }, 120)
      }
      const onData = (d: Buffer): void => {
        if (PROMPT_RE.test(d.toString('utf8'))) send()
      }
      stream.on('data', onData)
      setTimeout(send, 2000)
    }
    return id
  }

  write(termId: string, data: string | Uint8Array): void {
    const t = this.terms.get(termId)
    if (!t) return
    t.stream.write(typeof data === 'string' ? data : Buffer.from(data))
  }

  resize(termId: string, cols: number, rows: number): void {
    const t = this.terms.get(termId)
    if (!t) return
    try {
      t.stream.setWindow(Math.max(rows, 2), Math.max(cols, 10), 0, 0)
    } catch {
      /* ignore */
    }
  }

  close(termId: string): void {
    const t = this.terms.get(termId)
    if (!t) return
    this.terms.delete(termId)
    try {
      t.stream.close()
    } catch {
      /* ignore */
    }
  }

  closeForSession(sessionId: string): void {
    for (const [id, t] of this.terms) if (t.sessionId === sessionId) this.close(id)
  }

  closeAll(): void {
    for (const id of [...this.terms.keys()]) this.close(id)
  }
}

export const terminals = new TerminalService()
