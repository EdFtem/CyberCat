import { existsSync, promises as fsp } from 'fs'
import { homedir, userInfo } from 'os'
import { basename, dirname, isAbsolute, join, resolve } from 'path'
import type { Profile, SshConfigHost } from '@shared/types'
import { profiles } from '../store/profiles'

/** Один блок Host із ~/.ssh/config. implicit = опції до першого Host */
export interface SshConfigBlock {
  patterns: string[]
  options: Map<string, string[]>
  implicit?: boolean
}

export function expandTilde(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2))
  return p
}

function currentUser(): string {
  try {
    return userInfo().username
  } catch {
    return process.env.USERNAME || process.env.USER || 'root'
  }
}

/** Підстановка токенів %d %h %r %u %n %% як у ssh_config */
function expandTokens(value: string, ctx: { host: string; user: string; alias: string }): string {
  return value.replace(/%([dhrun%])/g, (_m, t: string) => {
    switch (t) {
      case 'd':
        return homedir()
      case 'h':
        return ctx.host
      case 'r':
      case 'u':
        return ctx.user
      case 'n':
        return ctx.alias
      default:
        return '%'
    }
  })
}

/** Розбиття аргументів з урахуванням лапок */
export function splitArgs(value: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value))) out.push(m[1] ?? m[2])
  return out
}

export function globToRegExp(pattern: string, caseSensitive = false): RegExp {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${esc}$`, caseSensitive ? '' : 'i')
}

/** Правила ssh: будь-який заперечний шаблон, що збігся, виключає; інакше потрібен хоч один позитивний збіг */
export function matchesPatterns(patterns: string[], name: string): boolean {
  let matched = false
  for (const p of patterns) {
    if (p.startsWith('!')) {
      if (globToRegExp(p.slice(1)).test(name)) return false
    } else if (globToRegExp(p).test(name)) matched = true
  }
  return matched
}

export function parseSshConfigText(text: string): SshConfigBlock[] {
  const blocks: SshConfigBlock[] = []
  let current: SshConfigBlock | null = { patterns: ['*'], options: new Map(), implicit: true }
  blocks.push(current)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(\S+?)\s*(?:=\s*|\s+)(.+)$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'host') {
      current = { patterns: splitArgs(value), options: new Map() }
      blocks.push(current)
      continue
    }
    if (key === 'match') {
      // Блоки Match не підтримуємо: їх умови залежать від середовища виконання ssh
      current = null
      continue
    }
    if (!current) continue
    const arr = current.options.get(key) ?? []
    arr.push(value)
    current.options.set(key, arr)
  }
  return blocks
}

async function expandIncludeGlob(token: string): Promise<string[]> {
  const expanded = expandTilde(token)
  const p = isAbsolute(expanded) ? expanded : join(homedir(), '.ssh', expanded)
  if (!/[*?]/.test(basename(p))) return [p]
  const dir = dirname(p)
  const re = globToRegExp(basename(p), true)
  try {
    const names = await fsp.readdir(dir)
    return names
      .filter((n) => re.test(n))
      .sort()
      .map((n) => join(dir, n))
  } catch {
    return []
  }
}

/** Прочитати ~/.ssh/config разом з Include; порядок блоків зберігається */
export async function loadSshConfig(file = join(homedir(), '.ssh', 'config'), seen = new Set<string>()): Promise<SshConfigBlock[]> {
  const abs = resolve(expandTilde(file))
  if (seen.has(abs) || !existsSync(abs)) return []
  seen.add(abs)
  let text: string
  try {
    text = await fsp.readFile(abs, 'utf8')
  } catch {
    return []
  }
  const out: SshConfigBlock[] = []
  for (const block of parseSshConfigText(text)) {
    const includes = block.options.get('include') ?? []
    block.options.delete('include')
    out.push(block)
    for (const inc of includes) {
      for (const token of splitArgs(inc)) {
        for (const f of await expandIncludeGlob(token)) {
          const sub = await loadSshConfig(f, seen)
          for (const sb of sub) {
            if (sb.implicit) {
              for (const [k, v] of sb.options) if (!block.options.has(k)) block.options.set(k, v)
            } else out.push(sb)
          }
        }
      }
    }
  }
  return out
}

/** Ефективні опції для імені: перше значення виграє, IdentityFile накопичується */
export function effectiveOptions(blocks: SshConfigBlock[], name: string): Map<string, string[]> {
  const eff = new Map<string, string[]>()
  for (const b of blocks) {
    if (!matchesPatterns(b.patterns, name)) continue
    for (const [k, v] of b.options) {
      if (k === 'identityfile') eff.set(k, [...(eff.get(k) ?? []), ...v])
      else if (!eff.has(k)) eff.set(k, v)
    }
  }
  return eff
}

export function hostFromBlocks(blocks: SshConfigBlock[], alias: string): SshConfigHost {
  const eff = effectiveOptions(blocks, alias)
  const user = eff.get('user')?.[0]
  const hostRaw = eff.get('hostname')?.[0] ?? alias
  const host = expandTokens(hostRaw, { host: alias, user: user ?? currentUser(), alias })
  const port = Number(eff.get('port')?.[0]) || 22
  const ids = (eff.get('identityfile') ?? []).map((v) => expandTilde(expandTokens(v, { host, user: user ?? currentUser(), alias })))
  const identityFile = ids.find((f) => !f.endsWith('-cert.pub') && existsSync(f))
  const pj = eff.get('proxyjump')?.[0]
  return {
    alias,
    host,
    port,
    user,
    identityFile,
    proxyJump: pj && pj.toLowerCase() !== 'none' ? pj : undefined
  }
}

function isConcrete(pattern: string): boolean {
  return !/[*?!]/.test(pattern)
}

export async function listSshConfigHosts(): Promise<SshConfigHost[]> {
  const blocks = await loadSshConfig()
  const aliases: string[] = []
  for (const b of blocks) {
    if (b.implicit) continue
    for (const p of b.patterns) if (isConcrete(p) && !aliases.includes(p)) aliases.push(p)
  }
  const existing = profiles.list()
  return aliases.map((alias) => {
    const h = hostFromBlocks(blocks, alias)
    const user = h.user ?? currentUser()
    h.exists = existing.some((p) => p.host.toLowerCase() === h.host.toLowerCase() && p.port === h.port && p.username === user)
    return h
  })
}

/** Опції для довільного імені хоста, навіть якщо блоку немає */
export async function resolveSshHost(name: string): Promise<SshConfigHost> {
  return hostFromBlocks(await loadSshConfig(), name)
}

function defaultKey(): string | undefined {
  for (const n of ['id_ed25519', 'id_ecdsa', 'id_rsa']) {
    const p = join(homedir(), '.ssh', n)
    if (existsSync(p)) return p
  }
  return undefined
}

export async function importSshHosts(aliases: string[]): Promise<Profile[]> {
  const hosts = await listSshConfigHosts()
  const wanted = new Set(aliases)
  const existing = profiles.list()
  const saved: Profile[] = []
  for (const h of hosts) {
    if (!wanted.has(h.alias)) continue
    const prev = existing.find((p) => p.name === h.alias && p.group === 'ssh config')
    const keyPath = h.identityFile ?? defaultKey()
    const profile: Profile = {
      id: prev?.id ?? '',
      name: h.alias,
      host: h.host,
      port: h.port,
      username: h.user ?? currentUser(),
      auth: keyPath ? 'key' : 'password',
      keyPath,
      proxyJump: h.proxyJump,
      savePassword: prev?.savePassword ?? false,
      color: prev?.color,
      group: 'ssh config',
      remotePath: prev?.remotePath,
      localPath: prev?.localPath,
      createdAt: prev?.createdAt ?? Date.now(),
      lastUsedAt: prev?.lastUsedAt
    }
    saved.push(profiles.save(profile))
  }
  return saved
}
