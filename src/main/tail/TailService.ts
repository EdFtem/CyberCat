import { randomUUID } from 'crypto'
import { StringDecoder } from 'string_decoder'
import type { ClientChannel } from 'ssh2'
import { broadcast } from '../broadcast'
import { bus } from '../bus'
import { sessions } from '../ssh/SessionManager'
import type { Session } from '../ssh/Session'
import { getFs } from '../fs'
import { shq } from '../fs/sftpUtil'
import type { TailData, TailExit, Target } from '@shared/types'

const INITIAL_BYTES = 256 * 1024
const POLL_MS = 1000
const CHUNK_MAX = 1024 * 1024
const BUFFER_MAX = 2 * 1024 * 1024

interface Tail {
  sessionId?: string
  chunks: { seq: number; data: string }[]
  bytes: number
  nextSeq: number
  stop: () => void
  stopped: boolean
}

/** Живий перегляд файлу: tail -F через shell або опитування через SFTP чи локальну ФС */
class TailService {
  private tails = new Map<string, Tail>()

  constructor() {
    bus.on('session:removed', (id: string) => this.stopForSession(id))
  }

  private push(id: string, data: string): void {
    const t = this.tails.get(id)
    if (!t || !data) return
    const seq = t.nextSeq++
    t.chunks.push({ seq, data })
    t.bytes += data.length
    while (t.bytes > BUFFER_MAX && t.chunks.length > 1) {
      const first = t.chunks.shift()!
      t.bytes -= first.data.length
    }
    const payload: TailData & { seq: number } = { tailId: id, data, seq }
    broadcast('tail:data', payload)
    bus.emit('tail:data', payload)
  }

  private finish(id: string, error?: string): void {
    const t = this.tails.get(id)
    if (!t || t.stopped) return
    t.stopped = true
    this.tails.delete(id)
    const payload: TailExit = { tailId: id, error }
    broadcast('tail:exit', payload)
    bus.emit('tail:exit', payload)
  }

  /** Накопичений вміст, щоб UI міг підхопити все, що прийшло до підписки */
  snapshot(id: string): { text: string; seq: number } {
    const t = this.tails.get(id)
    if (!t) return { text: '', seq: 0 }
    return { text: t.chunks.map((c) => c.data).join(''), seq: t.nextSeq - 1 }
  }

  async start(target: Target, path: string, lines = 200): Promise<string> {
    const id = randomUUID()
    const sessionId = target === 'local' ? undefined : target
    const rec: Tail = { sessionId, chunks: [], bytes: 0, nextSeq: 1, stop: () => {}, stopped: false }
    this.tails.set(id, rec)
    try {
      if (sessionId) {
        const session = sessions.require(sessionId)
        if (session.info.hasShell && (await this.startExec(id, rec, session, path, lines))) return id
      }
      await this.startPoll(id, rec, target, path, lines)
      return id
    } catch (e) {
      this.tails.delete(id)
      throw e
    }
  }

  /** Довільна команда з потоковим виводом (наприклад docker logs -f) */
  async startCommand(sessionId: string, cmd: string): Promise<string> {
    const session = sessions.require(sessionId)
    if (!session.info.hasShell) throw new Error('Потрібен доступ до shell на сервері')
    const id = randomUUID()
    const rec: Tail = { sessionId, chunks: [], bytes: 0, nextSeq: 1, stop: () => {}, stopped: false }
    this.tails.set(id, rec)
    const ok = await this.startExec(id, rec, session, cmd, 0, true)
    if (!ok) {
      this.tails.delete(id)
      throw new Error('Команда завершилась одразу після запуску')
    }
    return id
  }

  /** tail -F у pty: закриття каналу надсилає SIGHUP і процес завершується */
  private startExec(id: string, rec: Tail, session: Session, path: string, lines: number, rawCommand = false): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      session
        .execStream(rawCommand ? path : `tail -n ${Math.max(0, Math.floor(lines))} -F -- ${shq(path)}`, { pty: true })
        .then((stream: ClientChannel) => {
          const decoder = new StringDecoder('utf8')
          let decided = false
          let gotData = false
          const timer = setTimeout(() => {
            decided = true
            resolve(true)
          }, 1200)
          const onData = (d: Buffer): void => {
            gotData = true
            this.push(id, decoder.write(d).replace(/\r\n/g, '\n'))
          }
          stream.on('data', onData)
          stream.stderr.on('data', onData)
          stream.on('close', (code: number | null) => {
            const tail = decoder.end()
            if (tail) this.push(id, tail)
            if (!decided) {
              // Команда завершилась одразу: tail відсутній або файл недоступний, переходимо на опитування
              clearTimeout(timer)
              decided = true
              rec.chunks = []
              rec.bytes = 0
              resolve(false)
              return
            }
            this.finish(id, code && code !== 0 && code !== 129 ? `tail завершився з кодом ${code}` : undefined)
          })
          stream.on('error', () => {
            /* обробляється через close */
          })
          rec.stop = () => {
            try {
              stream.close()
            } catch {
              /* ignore */
            }
            this.finish(id)
          }
          if (!gotData) {
            /* чекаємо таймер або close */
          }
        })
        .catch(() => resolve(false))
    })
  }

  private async startPoll(id: string, rec: Tail, target: Target, path: string, lines: number): Promise<void> {
    const fs = getFs(target)
    const st = await fs.stat(path)
    if (st.isDir) throw new Error('Це тека, а не файл')
    let offset = Math.max(0, st.size - INITIAL_BYTES)
    const initial = (await fs.readRange(path, offset, st.size - offset)).toString('utf8')
    let text = initial
    if (offset > 0) {
      const nl = text.indexOf('\n')
      if (nl >= 0) text = text.slice(nl + 1)
    }
    const arr = text.split('\n')
    if (arr.length > lines + 1) text = arr.slice(-(lines + 1)).join('\n')
    offset = st.size
    this.push(id, text)

    let busy = false
    let errors = 0
    const decoder = new StringDecoder('utf8')
    const timer = setInterval(async () => {
      if (busy) return
      busy = true
      try {
        const s = await fs.stat(path)
        if (s.size < offset) {
          offset = 0
          this.push(id, '\n[файл обрізано або замінено]\n')
        }
        if (s.size > offset) {
          const len = Math.min(s.size - offset, CHUNK_MAX)
          const buf = await fs.readRange(path, offset, len)
          offset += buf.length
          this.push(id, decoder.write(buf))
        }
        errors = 0
      } catch (e) {
        errors++
        if (errors > 5) {
          clearInterval(timer)
          this.finish(id, e instanceof Error ? e.message : String(e))
        }
      } finally {
        busy = false
      }
    }, POLL_MS)
    rec.stop = () => {
      clearInterval(timer)
      this.finish(id)
    }
  }

  stop(id: string): void {
    this.tails.get(id)?.stop()
  }

  stopForSession(sessionId: string): void {
    for (const [id, t] of this.tails) if (t.sessionId === sessionId) this.stop(id)
  }

  stopAll(): void {
    for (const id of [...this.tails.keys()]) this.stop(id)
  }
}

export const tails = new TailService()
