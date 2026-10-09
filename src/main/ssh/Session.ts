import { EventEmitter } from 'events'
import { promises as fsp } from 'fs'
import type { Duplex } from 'stream'
import { Client, utils } from 'ssh2'
import type { ClientChannel, ConnectConfig, ExecOptions, SFTPWrapper } from 'ssh2'
import { prompt } from '../prompter'
import { profiles } from '../store/profiles'
import { settings } from '../store/settings'
import { fingerprint, hostKeys, parseKeyType } from './hostKeys'
import { resolveSshHost } from './sshConfig'
import { sftpRealpath } from '../fs/sftpUtil'
import type {
  AuthAnswer,
  AuthMethod,
  HostKeyAnswer,
  PassphraseAnswer,
  PasswordAnswer,
  Profile,
  SessionInfo,
  SessionStatus
} from '@shared/types'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

interface Endpoint {
  host: string
  port: number
  username: string
}

interface Hop extends Endpoint {
  auth: AuthMethod
  keyPath?: string
  label: string
}

const MAX_RECONNECT = 3

/** Розбір ProxyJump: [user@]host[:port], кілька через кому */
export function parseProxyJump(spec: string): { user?: string; host: string; port?: number }[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== 'none')
    .map((s) => {
      let user: string | undefined
      let rest = s
      const at = rest.lastIndexOf('@')
      if (at >= 0) {
        user = rest.slice(0, at)
        rest = rest.slice(at + 1)
      }
      const m = /^\[([^\]]+)\](?::(\d+))?$/.exec(rest) ?? /^([^:]+)(?::(\d+))?$/.exec(rest)
      return { user, host: m ? m[1] : rest, port: m?.[2] ? Number(m[2]) : undefined }
    })
}

/** Одне SSH-з'єднання: клієнт, SFTP-канал, exec та shell, за потреби через ProxyJump */
export class Session extends EventEmitter {
  info: SessionInfo
  client?: Client
  private _sftp?: SFTPWrapper
  private jumpClients: Client[] = []
  private userClosed = false
  private ready = false
  private reconnectAttempts = 0
  private lastPassword?: string
  private reconnectTimer?: NodeJS.Timeout
  /** passphrase на час сесії, щоб не питати двічі для одного ключа */
  private passphrases = new Map<string, string>()

  constructor(
    public readonly id: string,
    public profile: Profile
  ) {
    super()
    this.info = {
      id,
      profileId: profile.id || undefined,
      name: profile.name || `${profile.username}@${profile.host}`,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      status: 'connecting',
      hasShell: false,
      color: profile.color,
      startRemotePath: profile.remotePath,
      startLocalPath: profile.localPath
    }
  }

  get sftp(): SFTPWrapper {
    if (!this._sftp || !this.ready) throw new Error('Сесію не підключено')
    return this._sftp
  }

  get isConnected(): boolean {
    return this.ready && !!this._sftp
  }

  private setStatus(status: SessionStatus, error?: string): void {
    this.info = { ...this.info, status, error }
    this.emit('update', this.info)
  }

  async connect(initialPassword?: string): Promise<void> {
    this.userClosed = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    const p = this.profile
    const target: Endpoint = { host: p.host, port: p.port, username: p.username }
    let password = initialPassword ?? this.lastPassword ?? profiles.getPassword(p.id)

    try {
      let sock: Duplex | undefined
      if (p.proxyJump?.trim()) {
        const chain = await this.openJumpChain(p.proxyJump, password)
        sock = chain.sock
        password = chain.password ?? password
      }

      const auth = await this.buildAuth(p.auth, p.keyPath, password, target, true)
      password = auth.password
      this.lastPassword = password

      const cfg: ConnectConfig = { ...this.baseConfig(target), ...auth.cfg }
      if (sock) cfg.sock = sock

      const client = await this.openRawClient(cfg, password, target, () => this.handleClose())
      this.client = client

      this._sftp = await new Promise<SFTPWrapper>((res, rej) => client.sftp((e, s) => (e ? rej(e) : res(s))))
      this.ready = true

      try {
        this.info.homeDir = await sftpRealpath(this._sftp, '.')
      } catch {
        this.info.homeDir = '/'
      }

      try {
        const r = await this.exec('echo __cybercat_ok__', 8000)
        this.info.hasShell = r.stdout.includes('__cybercat_ok__')
      } catch {
        this.info.hasShell = false
      }

      const wasReconnect = this.reconnectAttempts > 0
      this.reconnectAttempts = 0
      this.setStatus('connected')
      if (wasReconnect) this.emit('reconnected')
    } catch (e) {
      this.ready = false
      this.closeClient()
      const msg = humanizeError(e)
      this.setStatus('error', msg)
      throw new Error(msg)
    }
  }

  private baseConfig(ep: Endpoint): ConnectConfig {
    return {
      host: ep.host,
      port: ep.port,
      username: ep.username,
      readyTimeout: 25_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      tryKeyboard: true,
      hostVerifier: (key: Buffer, verify: (ok: boolean) => void) => {
        this.verifyHostKey(ep.host, ep.port, key).then(verify, () => verify(false))
      }
    }
  }

  private async loadKey(keyPath: string): Promise<{ privateKey: Buffer; passphrase?: string }> {
    const privateKey = await fsp.readFile(keyPath)
    const parsed = utils.parseKey(privateKey)
    if (!(parsed instanceof Error)) return { privateKey }
    if (!/passphrase|encrypted|decrypt/i.test(parsed.message)) {
      throw new Error(`Не вдалося прочитати ключ ${keyPath}: ${parsed.message}`)
    }
    const cached = this.passphrases.get(keyPath)
    if (cached && !(utils.parseKey(privateKey, cached) instanceof Error)) return { privateKey, passphrase: cached }
    const a = await prompt<PassphraseAnswer>('passphrase', { keyPath })
    if (a.passphrase == null) throw new Error('Підключення скасовано')
    const again = utils.parseKey(privateKey, a.passphrase)
    if (again instanceof Error) throw new Error(`Не вдалося розшифрувати ключ: ${again.message}`)
    this.passphrases.set(keyPath, a.passphrase)
    return { privateKey, passphrase: a.passphrase }
  }

  private async buildAuth(
    auth: AuthMethod,
    keyPath: string | undefined,
    password: string | undefined,
    ep: Endpoint,
    isTarget: boolean
  ): Promise<{ cfg: Partial<ConnectConfig>; password?: string }> {
    const cfg: Partial<ConnectConfig> = {}
    if (auth === 'key') {
      if (!keyPath) throw new Error('Не вказано файл приватного ключа')
      const k = await this.loadKey(keyPath)
      cfg.privateKey = k.privateKey
      if (k.passphrase) cfg.passphrase = k.passphrase
      return { cfg, password }
    }
    if (auth === 'agent') {
      cfg.agent = resolveAgent()
      return { cfg, password }
    }
    let pw = password
    if (!pw) {
      const a = await prompt<PasswordAnswer>('password', {
        host: ep.host,
        username: ep.username,
        canSave: isTarget && !!this.profile.id
      })
      if (a.password == null) throw new Error('Підключення скасовано')
      pw = a.password
      if (isTarget && a.save && this.profile.id) {
        profiles.setPassword(this.profile.id, pw)
        this.profile = { ...this.profile, savePassword: true }
      }
    }
    cfg.password = pw
    return { cfg, password: pw }
  }

  /** Ланцюжок проміжних хостів; повертає сокет до цільового сервера */
  private async openJumpChain(spec: string, password: string | undefined): Promise<{ sock: Duplex; password?: string }> {
    const raw = parseProxyJump(spec)
    if (!raw.length) throw new Error('Порожній ProxyJump')
    const hops: Hop[] = []
    for (const r of raw) {
      const cfgHost = await resolveSshHost(r.host)
      hops.push({
        host: cfgHost.host,
        port: r.port ?? cfgHost.port,
        username: r.user ?? cfgHost.user ?? this.profile.username,
        auth: cfgHost.identityFile ? 'key' : this.profile.auth,
        keyPath: cfgHost.identityFile ?? this.profile.keyPath,
        label: r.host
      })
    }

    let sock: Duplex | undefined
    let pw = password
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i]
      try {
        const auth = await this.buildAuth(hop.auth, hop.keyPath, pw, hop, false)
        pw = auth.password ?? pw
        const cfg: ConnectConfig = { ...this.baseConfig(hop), ...auth.cfg }
        if (sock) cfg.sock = sock
        const client = await this.openRawClient(cfg, pw, hop)
        this.jumpClients.push(client)
        const next = i + 1 < hops.length ? hops[i + 1] : { host: this.profile.host, port: this.profile.port }
        sock = await new Promise<Duplex>((res, rej) =>
          client.forwardOut('127.0.0.1', 0, next.host, next.port, (err, stream) =>
            err ? rej(new Error(`тунель до ${next.host}:${next.port} не вдався: ${err.message}`)) : res(stream)
          )
        )
      } catch (e) {
        throw new Error(`Проміжний хост ${hop.label}: ${humanizeError(e)}`)
      }
    }
    return { sock: sock!, password: pw }
  }

  private openRawClient(cfg: ConnectConfig, password: string | undefined, ep: Endpoint, onClose?: () => void): Promise<Client> {
    return new Promise<Client>((resolve, reject) => {
      const client = new Client()
      let settled = false
      let kbdTries = 0

      client.on('keyboard-interactive', (name, instructions, _lang, prompts, finish) => {
        const single = prompts.length === 1 && !prompts[0].echo
        if (password && single && kbdTries === 0) {
          kbdTries++
          finish([password])
          return
        }
        kbdTries++
        prompt<AuthAnswer>('auth', {
          host: ep.host,
          username: ep.username,
          name,
          instructions,
          prompts: prompts.map((pr) => ({ prompt: pr.prompt, echo: !!pr.echo }))
        })
          .then((a) => finish(a.responses ?? []))
          .catch(() => finish([]))
      })

      client.on('ready', () => {
        settled = true
        resolve(client)
      })
      client.on('error', (err) => {
        if (!settled) {
          settled = true
          reject(err)
          return
        }
        console.error(`[session ${this.id}] ${ep.host}: ${err.message}`)
      })
      client.on('close', () => {
        if (!settled) {
          settled = true
          reject(new Error('З’єднання закрито сервером'))
          return
        }
        onClose?.()
      })
      client.connect(cfg)
    })
  }

  private async verifyHostKey(host: string, port: number, key: Buffer): Promise<boolean> {
    const fp = fingerprint(key)
    const known = hostKeys.lookup(host, port)
    if (known && known.fingerprint === fp) return true
    const a = await prompt<HostKeyAnswer>('hostkey', {
      host,
      port,
      keyType: parseKeyType(key),
      fingerprint: fp,
      status: known ? 'changed' : 'new',
      previousFingerprint: known?.fingerprint
    })
    if (!a.accept) return false
    if (a.remember) hostKeys.save(host, port, key)
    return true
  }

  private handleClose(): void {
    const wasReady = this.ready
    this.ready = false
    this._sftp = undefined
    this.client = undefined
    this.endJumpClients()
    if (this.userClosed) {
      this.setStatus('disconnected')
      return
    }
    if (wasReady && this.reconnectAttempts < MAX_RECONNECT) {
      this.reconnectAttempts++
      const delay = 1500 * this.reconnectAttempts
      this.setStatus('reconnecting', `З’єднання втрачено, спроба ${this.reconnectAttempts} з ${MAX_RECONNECT}`)
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(() => {
          if (this.reconnectAttempts >= MAX_RECONNECT) {
            this.setStatus('disconnected', 'Не вдалося відновити з’єднання')
          }
        })
      }, delay)
      return
    }
    this.setStatus('disconnected', 'З’єднання втрачено')
  }

  private endJumpClients(): void {
    for (const c of this.jumpClients.reverse()) {
      try {
        c.removeAllListeners('close')
        c.end()
      } catch {
        /* ignore */
      }
    }
    this.jumpClients = []
  }

  private closeClient(): void {
    try {
      this.client?.removeAllListeners('close')
      this.client?.end()
    } catch {
      /* ignore */
    }
    this.client = undefined
    this._sftp = undefined
    this.endJumpClients()
  }

  disconnect(): void {
    this.userClosed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ready = false
    this.closeClient()
    this.setStatus('disconnected')
  }

  /** Виконати команду; повертає stdout/stderr/код */
  exec(cmd: string, timeoutMs = 60_000): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const client = this.client
      if (!client || !this.ready) return reject(new Error('Сесію не підключено'))
      client.exec(cmd, (err, stream) => {
        if (err) return reject(err)
        let stdout = ''
        let stderr = ''
        const timer = setTimeout(() => {
          stream.close()
          reject(new Error(`Команда не завершилась за ${Math.round(timeoutMs / 1000)} с`))
        }, timeoutMs)
        stream.on('data', (d: Buffer) => (stdout += d.toString('utf8')))
        stream.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')))
        stream.on('close', (code: number | null) => {
          clearTimeout(timer)
          resolve({ stdout, stderr, code: code ?? 0 })
        })
        stream.on('error', (e: Error) => {
          clearTimeout(timer)
          reject(e)
        })
      })
    })
  }

  /** Запустити команду і повернути потік для довгих процесів (tail -F тощо) */
  execStream(cmd: string, opts: ExecOptions = {}): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      const client = this.client
      if (!client || !this.ready) return reject(new Error('Сесію не підключено'))
      client.exec(cmd, opts, (err, stream) => (err ? reject(err) : resolve(stream)))
    })
  }

  shell(cols: number, rows: number): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      const client = this.client
      if (!client || !this.ready) return reject(new Error('Сесію не підключено'))
      client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
        if (err) return reject(err)
        resolve(stream)
      })
    })
  }
}

function resolveAgent(): string {
  const custom = settings.get().agentPath?.trim()
  if (custom) return custom
  if (process.env.SSH_AUTH_SOCK) return process.env.SSH_AUTH_SOCK
  if (process.platform === 'win32') return '\\\\.\\pipe\\openssh-ssh-agent'
  return ''
}

export function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/All configured authentication methods failed/i.test(msg)) {
    return 'Автентифікація не вдалася: невірний пароль, ключ або ім’я користувача'
  }
  if (/ECONNREFUSED/i.test(msg)) return 'Сервер відхилив з’єднання. Перевірте адресу та порт'
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return 'Не вдалося знайти хост. Перевірте адресу'
  if (/ETIMEDOUT|Timed out while waiting for handshake/i.test(msg)) {
    return 'Час очікування вичерпано. Сервер не відповідає'
  }
  if (/Host key verification|hostVerifier|host key/i.test(msg)) return 'Ключ сервера відхилено'
  if (/agent/i.test(msg) && /ENOENT|ECONNREFUSED|EPIPE/i.test(msg)) {
    return 'SSH-агент недоступний. Запустіть ssh-agent або Pageant'
  }
  return msg
}
