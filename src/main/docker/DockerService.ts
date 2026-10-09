import { sessions } from '../ssh/SessionManager'
import type { Session } from '../ssh/Session'
import { shq } from '../fs/sftpUtil'
import type {
  DockerContainer,
  DockerContainerAction,
  DockerDiskUsage,
  DockerImage,
  DockerInfo,
  DockerPort,
  DockerVolume
} from '@shared/types'

const infoCache = new Map<string, { info: DockerInfo; at: number; sudo: boolean }>()
const INFO_TTL = 60_000

function parseJsonLines<T>(stdout: string): T[] {
  const out: T[] = []
  for (const line of stdout.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      out.push(JSON.parse(t) as T)
    } catch {
      /* пропускаємо сміття у виводі */
    }
  }
  return out
}

/** "0.0.0.0:8080->80/tcp, :::8080->80/tcp, 9000/tcp" → список портів без дублікатів IPv6 */
export function parsePorts(spec: string): DockerPort[] {
  const out: DockerPort[] = []
  const seen = new Set<string>()
  for (const raw of (spec || '').split(',')) {
    const part = raw.trim()
    if (!part) continue
    let hostIp: string | undefined
    let hostPort: number | undefined
    let rest = part
    const arrow = part.indexOf('->')
    if (arrow >= 0) {
      const left = part.slice(0, arrow)
      rest = part.slice(arrow + 2)
      const colon = left.lastIndexOf(':')
      hostIp = colon >= 0 ? left.slice(0, colon) : undefined
      const hp = Number(colon >= 0 ? left.slice(colon + 1) : left)
      if (Number.isFinite(hp)) hostPort = hp
    }
    const m = /^(\d+)(?:-(\d+))?\/(\w+)$/.exec(rest)
    if (!m) continue
    const containerPort = Number(m[1])
    const proto = m[3]
    const key = `${hostPort ?? ''}:${containerPort}/${proto}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ hostIp: hostIp === '::' ? '0.0.0.0' : hostIp, hostPort, containerPort, proto })
  }
  return out.sort((a, b) => (a.hostPort ?? 99999) - (b.hostPort ?? 99999) || a.containerPort - b.containerPort)
}

export async function detectDocker(sessionId: string, force = false): Promise<DockerInfo> {
  const s = sessions.require(sessionId)
  const cached = infoCache.get(sessionId)
  if (!force && cached && Date.now() - cached.at < INFO_TTL && cached.sudo === s.sudoActive) return cached.info
  const info = await detectUncached(s)
  infoCache.set(sessionId, { info, at: Date.now(), sudo: s.sudoActive })
  return info
}

async function detectUncached(s: Session): Promise<DockerInfo> {
  if (!s.info.hasShell) return { available: false, cli: 'docker', compose: false, error: 'Потрібен доступ до shell на сервері' }
  const which = await s.exec('command -v docker 2>/dev/null || command -v podman 2>/dev/null || echo __none__', 15_000)
  const bin = which.stdout.trim().split('\n').filter(Boolean).pop() ?? '__none__'
  if (bin === '__none__') return { available: false, cli: 'docker', compose: false, error: 'На сервері не знайдено docker або podman' }
  const cli: DockerInfo['cli'] = /podman/.test(bin) ? 'podman' : 'docker'
  const ver = await s.exec(`${cli} version --format '{{.Client.Version}}|{{.Server.Version}}' 2>&1`, 20_000)
  const text = (ver.stdout + ver.stderr).trim()
  if (ver.code !== 0 || /permission denied|cannot connect|dial unix|connect: /i.test(text)) {
    const denied = /permission denied/i.test(text)
    return {
      available: true,
      cli,
      compose: false,
      needsSudo: denied && !s.sudoActive,
      error: denied
        ? `Немає доступу до Docker daemon для користувача ${s.info.username}. Увімкніть sudo-режим або додайте користувача до групи docker`
        : /cannot connect|dial unix|connect: /i.test(text)
          ? 'Docker daemon не запущено'
          : text.slice(0, 300)
    }
  }
  const [version, serverVersion] = ver.stdout.trim().split('|')
  const compose = (await s.exec(`${cli} compose version >/dev/null 2>&1 && echo yes || echo no`, 15_000)).stdout.includes('yes')
  return { available: true, cli, version, serverVersion, compose }
}

async function cliFor(sessionId: string): Promise<{ s: Session; cli: string }> {
  const s = sessions.require(sessionId)
  const info = await detectDocker(sessionId)
  if (!info.available || info.error) throw new Error(info.error ?? 'Docker недоступний')
  return { s, cli: info.cli }
}

interface PsRow {
  ID: string
  Names: string
  Image: string
  State: string
  Status: string
  Ports: string
  CreatedAt: string
  RunningFor: string
  Command: string
}
interface StatsRow {
  Name: string
  Container: string
  CPUPerc: string
  MemUsage: string
  MemPerc: string
  NetIO: string
  BlockIO: string
}

export async function listContainers(sessionId: string): Promise<DockerContainer[]> {
  const { s, cli } = await cliFor(sessionId)
  const [ps, stats] = await Promise.all([
    s.exec(`${cli} ps -a --no-trunc --format '{{json .}}'`, 60_000),
    s.exec(`${cli} stats --no-stream --format '{{json .}}' 2>/dev/null`, 60_000)
  ])
  if (ps.code !== 0) throw new Error(ps.stderr.trim() || 'docker ps не вдався')
  const rows = parseJsonLines<PsRow>(ps.stdout)
  const statRows = parseJsonLines<StatsRow>(stats.stdout)
  const statsByName = new Map(statRows.map((r) => [r.Name, r]))

  const details = new Map<string, { labels: Record<string, string>; restarts: number; health?: string; policy?: string }>()
  if (rows.length) {
    const ids = rows.map((r) => shq(r.ID)).join(' ')
    const insp = await s.exec(
      `${cli} inspect --format '{{.Id}}\t{{json .Config.Labels}}\t{{.RestartCount}}\t{{if .State.Health}}{{.State.Health.Status}}{{end}}\t{{.HostConfig.RestartPolicy.Name}}' ${ids} 2>/dev/null`,
      60_000
    )
    for (const line of insp.stdout.split('\n')) {
      const [id, labelsJson, restarts, health, policy] = line.split('\t')
      if (!id) continue
      let labels: Record<string, string> = {}
      try {
        labels = (JSON.parse(labelsJson || 'null') as Record<string, string> | null) ?? {}
      } catch {
        labels = {}
      }
      details.set(id, { labels, restarts: Number(restarts) || 0, health: health || undefined, policy: policy || undefined })
    }
  }

  return rows.map((r) => {
    const name = r.Names.split(',')[0]
    const d = details.get(r.ID)
    const st = statsByName.get(name)
    const labels = d?.labels ?? {}
    const files = labels['com.docker.compose.project.config_files']
    return {
      id: r.ID,
      shortId: r.ID.slice(0, 12),
      name,
      image: r.Image,
      state: r.State,
      status: r.Status,
      created: r.CreatedAt,
      command: r.Command,
      ports: parsePorts(r.Ports),
      labels,
      project: labels['com.docker.compose.project'],
      service: labels['com.docker.compose.service'],
      composeFiles: files ? files.split(',').map((f) => f.trim()).filter(Boolean) : undefined,
      composeDir: labels['com.docker.compose.project.working_dir'],
      cpu: st?.CPUPerc,
      mem: st?.MemUsage,
      memPerc: st?.MemPerc,
      netIO: st?.NetIO,
      blockIO: st?.BlockIO,
      health: d?.health,
      restarts: d?.restarts,
      restartPolicy: d?.policy
    }
  })
}

export async function containerAction(sessionId: string, id: string, action: DockerContainerAction, force = false): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const verb = action === 'rm' ? `rm${force ? ' -f' : ''}` : action
  const r = await s.exec(`${cli} ${verb} ${shq(id)} 2>&1`, 120_000)
  if (r.code !== 0) throw new Error((r.stdout + r.stderr).trim() || `${cli} ${action} завершився з кодом ${r.code}`)
  return (r.stdout + r.stderr).trim()
}

export async function inspectContainer(sessionId: string, id: string): Promise<unknown> {
  const { s, cli } = await cliFor(sessionId)
  const r = await s.exec(`${cli} inspect ${shq(id)}`, 60_000)
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'inspect не вдався')
  const arr = JSON.parse(r.stdout) as unknown[]
  return arr[0]
}

interface ImageRow {
  ID: string
  Repository: string
  Tag: string
  Size: string
  CreatedSince: string
  CreatedAt: string
}

export async function listImages(sessionId: string): Promise<DockerImage[]> {
  const { s, cli } = await cliFor(sessionId)
  const r = await s.exec(`${cli} images --format '{{json .}}'`, 60_000)
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'docker images не вдався')
  const used = new Set<string>()
  const ps = await s.exec(`${cli} ps -a --format '{{.Image}}'`, 30_000)
  for (const l of ps.stdout.split('\n')) if (l.trim()) used.add(l.trim())
  return parseJsonLines<ImageRow>(r.stdout).map((i) => ({
    id: i.ID,
    repository: i.Repository,
    tag: i.Tag,
    size: i.Size,
    created: i.CreatedSince || i.CreatedAt,
    dangling: i.Repository === '<none>' || i.Tag === '<none>',
    inUse: used.has(`${i.Repository}:${i.Tag}`) || used.has(i.Repository) || used.has(i.ID)
  }))
}

export async function imageAction(sessionId: string, id: string, action: 'rm' | 'pull', force = false): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const cmd = action === 'rm' ? `${cli} rmi${force ? ' -f' : ''} ${shq(id)}` : `${cli} pull ${shq(id)}`
  const r = await s.exec(`${cmd} 2>&1`, 600_000)
  if (r.code !== 0) throw new Error((r.stdout + r.stderr).trim() || `${cmd} завершився з кодом ${r.code}`)
  return (r.stdout + r.stderr).trim()
}

interface VolumeRow {
  Name: string
  Driver: string
  Mountpoint: string
  Labels: string
  Scope: string
}

export async function listVolumes(sessionId: string): Promise<DockerVolume[]> {
  const { s, cli } = await cliFor(sessionId)
  const [ls, dangling] = await Promise.all([
    s.exec(`${cli} volume ls --format '{{json .}}'`, 60_000),
    s.exec(`${cli} volume ls -q -f dangling=true 2>/dev/null`, 60_000)
  ])
  if (ls.code !== 0) throw new Error(ls.stderr.trim() || 'docker volume ls не вдався')
  const unused = new Set(dangling.stdout.split('\n').map((x) => x.trim()).filter(Boolean))
  return parseJsonLines<VolumeRow>(ls.stdout).map((v) => ({
    name: v.Name,
    driver: v.Driver,
    mountpoint: v.Mountpoint,
    inUse: !unused.has(v.Name)
  }))
}

export async function volumeAction(sessionId: string, name: string, action: 'rm', force = false): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const r = await s.exec(`${cli} volume rm${force ? ' -f' : ''} ${shq(name)} 2>&1`, 120_000)
  if (r.code !== 0) throw new Error((r.stdout + r.stderr).trim() || `volume ${action} завершився з кодом ${r.code}`)
  return (r.stdout + r.stderr).trim()
}

interface DfRow {
  Type: string
  TotalCount: string
  Active: string
  Size: string
  Reclaimable: string
}

export async function diskUsage(sessionId: string): Promise<DockerDiskUsage[]> {
  const { s, cli } = await cliFor(sessionId)
  const r = await s.exec(`${cli} system df --format '{{json .}}' 2>/dev/null`, 120_000)
  return parseJsonLines<DfRow>(r.stdout).map((d) => ({ type: d.Type, total: Number(d.TotalCount) || 0, active: Number(d.Active) || 0, size: d.Size, reclaimable: d.Reclaimable }))
}

export async function prune(sessionId: string, what: 'images' | 'volumes' | 'containers' | 'system'): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const cmd =
    what === 'images' ? `${cli} image prune -f` : what === 'volumes' ? `${cli} volume prune -f` : what === 'containers' ? `${cli} container prune -f` : `${cli} system prune -f`
  const r = await s.exec(`${cmd} 2>&1`, 600_000)
  if (r.code !== 0) throw new Error((r.stdout + r.stderr).trim() || `${cmd} завершився з кодом ${r.code}`)
  return (r.stdout + r.stderr).trim()
}

/** Команда для логів контейнера, запускається через TailService */
export async function logsCommand(sessionId: string, id: string, tail: number): Promise<string> {
  const { cli } = await cliFor(sessionId)
  return `${cli} logs -f --tail ${Math.max(0, Math.floor(tail))} ${shq(id)}`
}

/** Команда для shell усередині контейнера, з урахуванням sudo-режиму */
export async function execShellCommand(sessionId: string, id: string): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const inner = `${cli} exec -it ${shq(id)} sh -c 'command -v bash >/dev/null 2>&1 && exec bash || exec sh'`
  return s.sudoActive ? `sudo ${inner}` : inner
}

/** Команда compose для проєкту */
export async function composeCommand(sessionId: string, project: string, dir: string | undefined, files: string[] | undefined, action: string): Promise<string> {
  const { s, cli } = await cliFor(sessionId)
  const parts = [cli, 'compose', '-p', shq(project)]
  if (dir) parts.push('--project-directory', shq(dir))
  for (const f of files ?? []) parts.push('-f', shq(f))
  parts.push(action)
  const cmd = parts.join(' ')
  return s.sudoActive ? `sudo ${cmd}` : cmd
}
