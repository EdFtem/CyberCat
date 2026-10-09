import { randomUUID } from 'crypto'
import net from 'net'
import { broadcast, toast } from '../broadcast'
import { bus } from '../bus'
import { sessions } from '../ssh/SessionManager'
import { tr } from '../i18n'
import type { Tunnel } from '@shared/types'

interface Active {
  info: Tunnel
  server: net.Server
  sockets: Set<net.Socket>
  warned?: boolean
}

/** Local tunnels to server ports over SSH (local port forwarding) */
class TunnelService {
  private tunnels = new Map<string, Active>()

  constructor() {
    bus.on('session:removed', (id: string) => this.stopForSession(id))
  }

  list(): Tunnel[] {
    return [...this.tunnels.values()].map((t) => t.info)
  }

  private emit(): void {
    broadcast('tunnel:update', this.list())
  }

  async start(sessionId: string, remoteHost: string, remotePort: number, localPort = 0): Promise<Tunnel> {
    sessions.require(sessionId)
    for (const t of this.tunnels.values()) {
      if (t.info.sessionId === sessionId && t.info.remoteHost === remoteHost && t.info.remotePort === remotePort) return t.info
    }
    const sockets = new Set<net.Socket>()
    const id = randomUUID()
    const server = net.createServer((sock) => {
      const session = sessions.get(sessionId)
      const client = session?.client
      if (!client || !session?.isConnected) {
        sock.destroy()
        return
      }
      client.forwardOut(sock.localAddress ?? '127.0.0.1', sock.localPort ?? 0, remoteHost, remotePort, (err, stream) => {
        if (err) {
          sock.destroy()
          const active = this.tunnels.get(id)
          if (active && !active.warned) {
            active.warned = true
            const hint = /administratively prohibited|open failed/i.test(err.message)
              ? tr().main.tunnel.forwardingDenied
              : err.message
            toast('error', tr().main.tunnel.failed(remoteHost, remotePort), hint)
          }
          return
        }
        sockets.add(sock)
        const info = this.tunnels.get(id)?.info
        if (info) {
          info.connections++
          this.emit()
        }
        const done = (): void => {
          if (sockets.delete(sock)) {
            const cur = this.tunnels.get(id)?.info
            if (cur) {
              cur.connections = Math.max(0, cur.connections - 1)
              this.emit()
            }
          }
          sock.destroy()
          stream.destroy()
        }
        sock.on('error', done).on('close', done)
        stream.on('error', done).on('close', done)
        sock.pipe(stream).pipe(sock)
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(localPort, '127.0.0.1', () => {
        server.removeListener('error', reject)
        resolve()
      })
    })
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : localPort
    const info: Tunnel = { id, sessionId, localPort: port, remoteHost, remotePort, connections: 0 }
    server.on('error', () => this.stop(id))
    this.tunnels.set(id, { info, server, sockets })
    this.emit()
    return info
  }

  stop(id: string): void {
    const t = this.tunnels.get(id)
    if (!t) return
    this.tunnels.delete(id)
    for (const s of t.sockets) s.destroy()
    try {
      t.server.close()
    } catch {
      /* ignore */
    }
    this.emit()
  }

  stopForSession(sessionId: string): void {
    for (const t of [...this.tunnels.values()]) if (t.info.sessionId === sessionId) this.stop(t.info.id)
  }

  stopAll(): void {
    for (const id of [...this.tunnels.keys()]) this.stop(id)
  }
}

export const tunnels = new TunnelService()
