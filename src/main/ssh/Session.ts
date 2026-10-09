import { EventEmitter } from 'events'
import { promises as fsp } from 'fs'
import { Client, utils } from 'ssh2'
import type { ClientChannel, ConnectConfig, SFTPWrapper } from 'ssh2'
import { prompt } from '../prompter'
import { profiles } from '../store/profiles'
import { settings } from '../store/settings'
import { fingerprint, hostKeys, parseKeyType } from './hostKeys'
import { sftpRealpath } from '../fs/sftpUtil'
import type {
  AuthAnswer,
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

const MAX_RECONNECT = 3

/** Одне SSH-з'єднання: клієнт, SFTP-канал, exec та shell */
export class Session extends EventEmitter {
  info: SessionInfo
  client?: Client
  private _sftp?: SFTPWrapper
  private userClosed = false
  private ready = false
  private reconnectAttempts = 0
  private lastPassword?: string
  private reconnectTimer?: NodeJS.Timeout

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
    let password = initialPassword ?? this.lastPassword ?? profiles.getPassword(p.id)
    let passphrase: string | undefined
    let privateKey: Buffer | undefined

    try {
      if (p.auth === 'key') {
        if (!p.keyPath) throw new Error('Не вказано файл приватного ключа')
        privateKey = await fsp.readFile(p.keyPath)
        const parsed = utils.parseKey(privateKey)
        if (parsed instanceof Error) {
          if (/passphrase|encrypted|decrypt/i.test(parsed.message)) {
            const a = await prompt<PassphraseAnswer>('passphrase', { keyPath: p.keyPath })
            if (a.passphrase == null) throw new Error('Підключення скасовано')
            passphrase = a.passphrase
            const again = utils.parseKey(privateKey, passphrase)
            if (again instanceof Error) throw new Error(`Не вдалося розшифрувати ключ: ${again.message}`)
          } else {
            throw new Error(`Не вдалося прочитати ключ: ${parsed.message}`)
          }
        }
      }

      if (p.auth === 'password' && !password) {
        const a = await prompt<PasswordAnswer>('password', {
          host: p.host,
          username: p.username,
          canSave: !!p.id
        })
        if (a.password == null) throw new Error('Підключення скасовано')
        password = a.password
        if (a.save && p.id) {
          profiles.setPassword(p.id, password)
          this.profile = { ...this.profile, savePassword: true }
        }
      }
      this.lastPassword = password

      const cfg: ConnectConfig = {
        host: p.host,
        port: p.port,
        username: p.username,
        readyTimeout: 25_000,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
        tryKeyboard: true,
        hostVerifier: (key: Buffer, verify: (ok: boolean) => void) => {
          this.verifyHostKey(key).then(verify, () => verify(false))
        }
      }
      if (p.auth === 'password') cfg.password = password
      if (p.auth === 'key') {
        cfg.privateKey = privateKey
        if (passphrase) cfg.passphrase = passphrase
      }
      if (p.auth === 'agent') cfg.agent = resolveAgent()

      await this.openClient(cfg, password)

      const client = this.client!
      this._sftp = await new Promise<SFTPWrapper>((res, rej) =>
        client.sftp((e, s) => (e ? rej(e) : res(s)))
      )
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

  private openClient(cfg: ConnectConfig, password: string | undefined): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = new Client()
      this.client = client
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
          host: this.profile.host,
          username: this.profile.username,
          name,
          instructions,
          prompts: prompts.map((pr) => ({ prompt: pr.prompt, echo: !!pr.echo }))
        })
          .then((a) => finish(a.responses ?? []))
          .catch(() => finish([]))
      })

      client.on('ready', () => {
        settled = true
        resolve()
      })
      client.on('error', (err) => {
        if (!settled) {
          settled = true
          reject(err)
          return
        }
        console.error(`[session ${this.id}] помилка з'єднання:`, err.message)
      })
      client.on('close', () => {
        if (!settled) {
          settled = true
          reject(new Error('З’єднання закрито сервером'))
          return
        }
        this.handleClose()
      })
      client.connect(cfg)
    })
  }

  private async verifyHostKey(key: Buffer): Promise<boolean> {
    const fp = fingerprint(key)
    const known = hostKeys.lookup(this.profile.host, this.profile.port)
    if (known && known.fingerprint === fp) return true
    const a = await prompt<HostKeyAnswer>('hostkey', {
      host: this.profile.host,
      port: this.profile.port,
      keyType: parseKeyType(key),
      fingerprint: fp,
      status: known ? 'changed' : 'new',
      previousFingerprint: known?.fingerprint
    })
    if (!a.accept) return false
    if (a.remember) hostKeys.save(this.profile.host, this.profile.port, key)
    return true
  }

  private handleClose(): void {
    const wasReady = this.ready
    this.ready = false
    this._sftp = undefined
    this.client = undefined
    if (this.userClosed) {
      this.setStatus('disconnected')
      return
    }
    if (wasReady && this.reconnectAttempts < MAX_RECONNECT) {
      this.reconnectAttempts++
      const delay = 1500 * this.reconnectAttempts
      this.setStatus(
        'reconnecting',
        `З’єднання втрачено, спроба ${this.reconnectAttempts} з ${MAX_RECONNECT}`
      )
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

  private closeClient(): void {
    try {
      this.client?.removeAllListeners('close')
      this.client?.end()
    } catch {
      /* ignore */
    }
    this.client = undefined
    this._sftp = undefined
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
