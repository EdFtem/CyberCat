import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  Container,
  Download,
  Eraser,
  ExternalLink,
  FileCode,
  HardDrive,
  Info,
  Layers,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  Square,
  Terminal,
  Trash2
} from 'lucide-react'
import { useApp } from '@/store/app'
import { ops } from '@/lib/ops'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import type { DockerContainer, DockerContainerAction, DockerDiskUsage, DockerImage, DockerInfo, DockerPort, DockerVolume } from '@shared/types'
import { Badge, Button, EmptyState, IconButton, Segmented, Spinner } from '../ui'

type Tab = 'containers' | 'images' | 'volumes'

const api = window.api

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function stateTone(c: DockerContainer): 'success' | 'warning' | 'danger' | 'neutral' {
  if (c.health === 'unhealthy' || c.state === 'dead') return 'danger'
  if (c.state === 'running') return 'success'
  if (c.state === 'paused' || c.state === 'restarting' || c.state === 'created') return 'warning'
  return 'neutral'
}

const toneDot: Record<string, string> = { success: 'bg-success', warning: 'bg-warning pulse', danger: 'bg-danger', neutral: 'bg-dim' }

export function DockerView({ sid }: { sid: string }) {
  const t = useT()
  const session = useApp((s) => s.sessions[sid])
  const setDockerOpen = useApp((s) => s.setDockerOpen)
  const pushToast = useApp((s) => s.pushToast)
  const openDialog = useApp((s) => s.openDialog)
  const toggleSudo = useApp((s) => s.toggleSudo)
  const openDoc = useApp((s) => s.openDoc)
  const [tab, setTab] = useState<Tab>('containers')
  const [info, setInfo] = useState<DockerInfo | null>(null)
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [images, setImages] = useState<DockerImage[]>([])
  const [volumes, setVolumes] = useState<DockerVolume[]>([])
  const [df, setDf] = useState<DockerDiskUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const infoRef = useRef<DockerInfo | null>(null)
  const sudo = !!session?.sudo

  const load = useCallback(
    async (silent: boolean, forceDetect: boolean) => {
      if (!silent) setLoading(true)
      try {
        let i = infoRef.current
        if (!i || forceDetect) {
          i = await api.docker.detect(sid, forceDetect)
          infoRef.current = i
          setInfo(i)
        }
        if (!i.available || i.error) return
        if (tab === 'containers') setContainers(await api.docker.containers(sid))
        else if (tab === 'images') {
          const [im, d] = await Promise.all([api.docker.images(sid), api.docker.diskUsage(sid)])
          setImages(im)
          setDf(d)
        } else {
          const [v, d] = await Promise.all([api.docker.volumes(sid), api.docker.diskUsage(sid)])
          setVolumes(v)
          setDf(d)
        }
        setError(null)
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setLoading(false)
      }
    },
    [sid, tab]
  )

  useEffect(() => {
    void load(false, true)
  }, [sid, sudo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (infoRef.current) void load(false, false)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!auto || tab !== 'containers') return
    const timer = window.setInterval(() => void load(true, false), 5000)
    return () => window.clearInterval(timer)
  }, [auto, tab, load])

  const mark = (id: string, on: boolean): void =>
    setBusy((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })

  const act = async (c: DockerContainer, action: DockerContainerAction, force = false): Promise<void> => {
    mark(c.id, true)
    try {
      await api.docker.action(sid, c.id, action, force)
      await load(true, false)
    } catch (e) {
      pushToast({ kind: 'error', title: `docker ${action} ${c.name}`, message: errMsg(e) })
    } finally {
      mark(c.id, false)
    }
  }

  const confirmRemove = (c: DockerContainer): void =>
    openDialog({
      kind: 'confirm',
      title: t.docker.removeContainerTitle(c.name),
      message: c.state === 'running' ? t.docker.removeRunningMessage : t.docker.removeStoppedMessage,
      danger: true,
      okLabel: t.docker.remove,
      onConfirm: () => act(c, 'rm', c.state === 'running')
    })

  const openPort = async (p: DockerPort): Promise<void> => {
    if (!p.hostPort) return
    try {
      const host = p.hostIp && p.hostIp !== '0.0.0.0' ? p.hostIp : '127.0.0.1'
      const tun = await api.tunnel.start(sid, host, p.hostPort)
      await api.app.openExternal(`http://localhost:${tun.localPort}`)
      pushToast({ kind: 'info', title: t.docker.tunnelOpened, message: t.docker.tunnelOpenedMessage(tun.localPort, host, p.hostPort) })
    } catch (e) {
      pushToast({ kind: 'error', title: t.docker.tunnelFailed, message: errMsg(e) })
    }
  }

  const compose = async (project: string, group: DockerContainer[], action: string, danger = false): Promise<void> => {
    const c = group[0]
    const run = async (): Promise<void> => {
      try {
        const cmd = await api.docker.composeCommand(sid, project, c.composeDir, c.composeFiles, action)
        openDialog({ kind: 'command', sessionId: sid, title: `compose ${action} · ${project}`, cmd })
      } catch (e) {
        pushToast({ kind: 'error', title: 'compose', message: errMsg(e) })
      }
    }
    if (danger) {
      openDialog({
        kind: 'confirm',
        title: t.docker.composeConfirmTitle(action, project),
        message: t.docker.composeDownMessage,
        danger: true,
        okLabel: action,
        onConfirm: run
      })
    } else await run()
  }

  const openComposeFile = (group: DockerContainer[]): void => {
    const f = group[0].composeFiles?.[0]
    if (!f) return
    setDockerOpen(sid, false)
    void openDoc(sid, sid, f)
  }

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const list = containers.filter((c) => !f || `${c.name} ${c.image} ${c.project ?? ''} ${c.status}`.toLowerCase().includes(f))
    const map = new Map<string, DockerContainer[]>()
    for (const c of list) {
      const k = c.project ?? ''
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(c)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  }, [containers, filter])

  const running = containers.filter((c) => c.state === 'running').length

  // ---- states without Docker
  if (info && (!info.available || info.error)) {
    return (
      <div className="flex-1 min-h-0 bg-surface rounded-lg border border-border flex flex-col">
        <Header />
        <EmptyState icon={<Container size={36} />} title={info.available ? t.docker.notAccessible : t.docker.notFound} description={info.error}>
          {info.needsSudo && (
            <Button variant="primary" icon={<ShieldAlert size={14} />} onClick={() => void toggleSudo(sid)}>
              {t.docker.enableSudo}
            </Button>
          )}
          <Button icon={<RefreshCw size={14} />} onClick={() => void load(false, true)}>
            {t.docker.checkAgain}
          </Button>
        </EmptyState>
      </div>
    )
  }

  function Header() {
    return (
      <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => setDockerOpen(sid, false)} title={t.docker.backToFiles}>
          {t.docker.files}
        </Button>
        <span className="w-px h-5 bg-border mx-1" />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <Container size={15} className="text-accent" /> Docker
        </span>
        {info?.serverVersion && (
          <span className="text-[11.5px] text-dim">
            {info.cli} {info.serverVersion}
            {info.compose && ' · compose'}
          </span>
        )}
        {sudo && <Badge tone="danger">root</Badge>}
        <span className="flex-1" />
        {info?.available && !info.error && (
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'containers', label: t.docker.tabContainers, icon: <Boxes size={13} /> },
                { value: 'images', label: t.docker.tabImages, icon: <Layers size={13} /> },
                { value: 'volumes', label: t.docker.tabVolumes, icon: <HardDrive size={13} /> }
              ]}
            />
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-[8px] text-dim" />
              <input className="input h-7 pl-7" placeholder={t.docker.filterPlaceholder} value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <IconButton title={auto ? t.docker.autoRefreshOn : t.docker.autoRefreshOff} active={auto} onClick={() => setAuto((a) => !a)}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 bg-surface rounded-lg border border-border flex flex-col">
      <Header />
      {error && <div className="px-3 py-2 text-[12.5px] text-danger border-b border-border">{error}</div>}

      <div className="flex-1 min-h-0 overflow-auto">
        {loading && !containers.length && !images.length && !volumes.length && (
          <div className="flex items-center justify-center h-40">
            <Spinner size={22} />
          </div>
        )}

        {tab === 'containers' && !loading && containers.length === 0 && !error && (
          <EmptyState icon={<Boxes size={32} />} title={t.docker.noContainers} description={t.docker.noContainersHint} />
        )}

        {tab === 'containers' &&
          groups.map(([project, group]) => (
            <div key={project || '__standalone'} className="mb-2">
              <div className="sticky top-0 z-10 flex items-center gap-2 px-3 h-9 bg-surface-2 border-b border-border/60 text-[12px]">
                <span className="font-medium">{project ? `compose · ${project}` : t.docker.standalone}</span>
                <span className="text-dim">{t.docker.containers(group.length)}</span>
                <span className="flex-1" />
                {project && info?.compose && (
                  <>
                    {group[0].composeFiles?.[0] && (
                      <IconButton title={t.docker.openFile(group[0].composeFiles[0])} size={26} onClick={() => openComposeFile(group)}>
                        <FileCode size={14} />
                      </IconButton>
                    )}
                    <IconButton title="compose up -d" size={26} onClick={() => void compose(project, group, 'up -d')}>
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton title="compose restart" size={26} onClick={() => void compose(project, group, 'restart')}>
                      <RotateCcw size={14} />
                    </IconButton>
                    <IconButton title="compose pull" size={26} onClick={() => void compose(project, group, 'pull')}>
                      <Download size={14} />
                    </IconButton>
                    <IconButton title="compose down" size={26} danger onClick={() => void compose(project, group, 'down', true)}>
                      <ArrowDown size={14} />
                    </IconButton>
                  </>
                )}
              </div>
              {group.map((c) => (
                <ContainerRow key={c.id} c={c} busy={busy.has(c.id)} onAct={act} onRemove={confirmRemove} onPort={openPort} sid={sid} />
              ))}
            </div>
          ))}

        {tab === 'images' && <ImagesTab sid={sid} images={images} df={df} filter={filter} reload={() => load(true, false)} />}
        {tab === 'volumes' && <VolumesTab sid={sid} volumes={volumes} df={df} filter={filter} reload={() => load(true, false)} />}
      </div>

      <div className="flex items-center gap-4 px-3 h-7 border-t border-border text-[11.5px] text-dim">
        {tab === 'containers' && (
          <span>{t.docker.runningOf(running, containers.length)}</span>
        )}
        {tab !== 'containers' && df.length > 0 && (
          <span>
            {df.map((d) => `${d.type}: ${d.size}${d.reclaimable && d.reclaimable !== '0B' ? ` ${t.docker.reclaimable(d.reclaimable)}` : ''}`).join(' · ')}
          </span>
        )}
        <span className="flex-1" />
        <span>{t.docker.portHint}</span>
      </div>
    </div>
  )
}

function ContainerRow({
  c,
  busy,
  sid,
  onAct,
  onRemove,
  onPort
}: {
  c: DockerContainer
  busy: boolean
  sid: string
  onAct: (c: DockerContainer, a: DockerContainerAction, force?: boolean) => Promise<void>
  onRemove: (c: DockerContainer) => void
  onPort: (p: DockerPort) => Promise<void>
}) {
  const t = useT()
  const openDialog = useApp((s) => s.openDialog)
  const tone = stateTone(c)
  const running = c.state === 'running'
  const paused = c.state === 'paused'
  return (
    <div className={cn('grid items-center gap-3 px-3 h-[52px] border-b border-border/50 hover:bg-surface-2', busy && 'opacity-60')} style={{ gridTemplateColumns: '10px minmax(160px,1.4fr) minmax(140px,1.2fr) minmax(120px,1fr) minmax(140px,1.3fr) 150px auto' }}>
      <span className={cn('h-2.5 w-2.5 rounded-full', toneDot[tone])} title={c.state} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[13px] truncate" title={c.name}>
            {c.name}
          </span>
          {c.health && <Badge tone={c.health === 'healthy' ? 'success' : c.health === 'unhealthy' ? 'danger' : 'warning'}>{c.health}</Badge>}
        </div>
        <div className="text-[11.5px] text-dim truncate">
          {c.shortId}
          {c.service && ` · ${c.service}`}
          {typeof c.restarts === 'number' && c.restarts > 0 && <span className={c.restarts > 3 ? 'text-danger' : ''}> · {t.docker.restarts(c.restarts)}</span>}
        </div>
      </div>
      <div className="min-w-0 text-[12px] text-muted truncate" title={c.image}>
        {c.image}
      </div>
      <div className="min-w-0 text-[12px] truncate" title={c.status}>
        <span className={cn(tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-dim')}>{c.status}</span>
      </div>
      <div className="flex flex-wrap gap-1 min-w-0">
        {c.ports.slice(0, 6).map((p, i) =>
          p.hostPort ? (
            <button
              key={i}
              type="button"
              className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded text-[11px] font-mono bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg transition-colors"
              title={t.docker.openPortTitle(`${p.hostIp ?? ''}:${p.hostPort}`)}
              onClick={() => void onPort(p)}
            >
              <ExternalLink size={10} /> {p.hostPort}→{p.containerPort}
              {p.proto !== 'tcp' && `/${p.proto}`}
            </button>
          ) : (
            <span key={i} className="inline-flex items-center h-[20px] px-1.5 rounded text-[11px] font-mono bg-surface-3 text-dim" title={t.docker.portNotPublished}>
              {p.containerPort}/{p.proto}
            </span>
          )
        )}
        {c.ports.length > 6 && <span className="text-[11px] text-dim">+{c.ports.length - 6}</span>}
      </div>
      <div className="text-[11.5px] text-dim font-mono tabular-nums truncate">
        {running && c.cpu ? (
          <>
            <span className="text-muted">CPU</span> {c.cpu} <span className="text-muted">MEM</span> {c.memPerc ?? c.mem}
          </>
        ) : (
          ''
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {running ? (
          <IconButton title={t.docker.stop} size={26} onClick={() => void onAct(c, 'stop')}>
            <Square size={13} />
          </IconButton>
        ) : paused ? (
          <IconButton title={t.docker.unpause} size={26} onClick={() => void onAct(c, 'unpause')}>
            <Play size={13} />
          </IconButton>
        ) : (
          <IconButton title={t.docker.start} size={26} onClick={() => void onAct(c, 'start')}>
            <Play size={13} />
          </IconButton>
        )}
        <IconButton title={t.docker.restart} size={26} onClick={() => void onAct(c, 'restart')}>
          <RotateCcw size={13} />
        </IconButton>
        {running && (
          <IconButton title={t.docker.pause} size={26} onClick={() => void onAct(c, 'pause')}>
            <Pause size={13} />
          </IconButton>
        )}
        <IconButton title={t.docker.followLogs} size={26} onClick={() => void ops.dockerLogs(sid, c)}>
          <ScrollText size={13} />
        </IconButton>
        <IconButton title={t.docker.shell} size={26} disabled={!running} onClick={() => void ops.dockerShell(sid, c)}>
          <Terminal size={13} />
        </IconButton>
        <IconButton title={t.docker.details} size={26} onClick={() => openDialog({ kind: 'dockerInspect', sessionId: sid, container: c })}>
          <Info size={13} />
        </IconButton>
        <IconButton title={t.docker.removeContainer} size={26} danger onClick={() => onRemove(c)}>
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
  )
}

function ImagesTab({ sid, images, filter, reload }: { sid: string; images: DockerImage[]; df: DockerDiskUsage[]; filter: string; reload: () => Promise<void> }) {
  const t = useT()
  const openDialog = useApp((s) => s.openDialog)
  const pushToast = useApp((s) => s.pushToast)
  const f = filter.trim().toLowerCase()
  const list = images.filter((i) => !f || `${i.repository}:${i.tag} ${i.id}`.toLowerCase().includes(f))
  const dangling = images.filter((i) => i.dangling).length
  const run = async (label: string, fn: () => Promise<string>): Promise<void> => {
    try {
      const out = await fn()
      pushToast({ kind: 'success', title: label, message: out.split('\n').slice(-3).join('\n') || undefined })
      await reload()
    } catch (e) {
      pushToast({ kind: 'error', title: label, message: errMsg(e) })
    }
  }
  return (
    <div>
      <div className="flex items-center gap-2 px-3 h-9 bg-surface-2 border-b border-border/60 text-[12px]">
        <span className="text-dim">{t.docker.images(images.length)}</span>
        {dangling > 0 && <Badge tone="warning">{t.docker.danglingCount(dangling)}</Badge>}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          icon={<Eraser size={13} />}
          disabled={!dangling}
          onClick={() =>
            openDialog({
              kind: 'confirm',
              title: t.docker.pruneImagesTitle,
              message: t.docker.pruneImagesMessage(dangling),
              okLabel: t.docker.prune,
              onConfirm: () => run('image prune', () => api.docker.prune(sid, 'images'))
            })
          }
        >
          {t.docker.pruneDangling}
        </Button>
      </div>
      {list.map((i) => (
        <div key={i.id} className="grid items-center gap-3 px-3 h-11 border-b border-border/50 hover:bg-surface-2" style={{ gridTemplateColumns: 'minmax(200px,2fr) 130px 100px minmax(120px,1fr) auto' }}>
          <div className="min-w-0">
            <div className="font-mono text-[13px] truncate">
              {i.dangling ? <span className="text-dim">{'<none>'}</span> : `${i.repository}:${i.tag}`}
            </div>
            <div className="text-[11.5px] text-dim">{i.id.replace(/^sha256:/, '').slice(0, 12)}</div>
          </div>
          <div className="text-[12px] text-muted tabular-nums">{i.size}</div>
          <div>{i.inUse ? <Badge tone="success">{t.docker.inUse}</Badge> : i.dangling ? <Badge tone="warning">{t.docker.dangling}</Badge> : <Badge tone="neutral">{t.docker.unused}</Badge>}</div>
          <div className="text-[12px] text-dim truncate">{i.created}</div>
          <div className="flex items-center gap-0.5">
            {!i.dangling && (
              <IconButton title={t.docker.pullImage} size={26} onClick={() => openDialog({ kind: 'command', sessionId: sid, title: `pull ${i.repository}:${i.tag}`, cmd: `docker pull ${i.repository}:${i.tag}` })}>
                <Download size={13} />
              </IconButton>
            )}
            <IconButton
              title={i.inUse ? t.docker.imageInUse : t.docker.removeImage}
              size={26}
              danger
              disabled={i.inUse}
              onClick={() =>
                openDialog({
                  kind: 'confirm',
                  title: t.docker.removeImageTitle(i.dangling ? i.id.slice(7, 19) : `${i.repository}:${i.tag}`),
                  message: t.docker.removeImageMessage(i.size),
                  danger: true,
                  okLabel: t.docker.remove,
                  onConfirm: () => run('rmi', () => api.docker.imageAction(sid, i.id, 'rm'))
                })
              }
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>
      ))}
      {!list.length && <EmptyState icon={<Layers size={30} />} title={t.docker.noImages} />}
    </div>
  )
}

function VolumesTab({ sid, volumes, filter, reload }: { sid: string; volumes: DockerVolume[]; df: DockerDiskUsage[]; filter: string; reload: () => Promise<void> }) {
  const t = useT()
  const openDialog = useApp((s) => s.openDialog)
  const pushToast = useApp((s) => s.pushToast)
  const f = filter.trim().toLowerCase()
  const list = volumes.filter((v) => !f || v.name.toLowerCase().includes(f))
  const unused = volumes.filter((v) => !v.inUse).length
  const run = async (label: string, fn: () => Promise<string>): Promise<void> => {
    try {
      const out = await fn()
      pushToast({ kind: 'success', title: label, message: out.split('\n').slice(-3).join('\n') || undefined })
      await reload()
    } catch (e) {
      pushToast({ kind: 'error', title: label, message: errMsg(e) })
    }
  }
  return (
    <div>
      <div className="flex items-center gap-2 px-3 h-9 bg-surface-2 border-b border-border/60 text-[12px]">
        <span className="text-dim">{t.docker.volumes(volumes.length)}</span>
        {unused > 0 && <Badge tone="warning">{t.docker.unusedCount(unused)}</Badge>}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          icon={<Eraser size={13} />}
          disabled={!unused}
          onClick={() =>
            openDialog({
              kind: 'confirm',
              title: t.docker.pruneVolumesTitle,
              message: t.docker.pruneVolumesMessage(unused),
              danger: true,
              okLabel: t.docker.prune,
              onConfirm: () => run('volume prune', () => api.docker.prune(sid, 'volumes'))
            })
          }
        >
          {t.docker.pruneUnused}
        </Button>
      </div>
      {list.map((v) => (
        <div key={v.name} className="grid items-center gap-3 px-3 h-11 border-b border-border/50 hover:bg-surface-2" style={{ gridTemplateColumns: 'minmax(200px,1.5fr) 90px minmax(200px,2fr) 150px auto' }}>
          <div className="font-mono text-[13px] truncate" title={v.name}>
            {v.name}
          </div>
          <div className="text-[12px] text-dim">{v.driver}</div>
          <div className="text-[11.5px] text-dim font-mono truncate" title={v.mountpoint}>
            {v.mountpoint}
          </div>
          <div>{v.inUse ? <Badge tone="success">{t.docker.inUse}</Badge> : <Badge tone="neutral">{t.docker.unused}</Badge>}</div>
          <div className="flex items-center gap-0.5">
            <IconButton
              title={v.inUse ? t.docker.volumeInUse : t.docker.removeVolume}
              size={26}
              danger
              disabled={v.inUse}
              onClick={() =>
                openDialog({
                  kind: 'confirm',
                  title: t.docker.removeVolumeTitle(v.name),
                  message: t.docker.removeVolumeMessage,
                  danger: true,
                  okLabel: t.docker.remove,
                  onConfirm: () => run('volume rm', () => api.docker.volumeAction(sid, v.name, 'rm'))
                })
              }
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>
      ))}
      {!list.length && <EmptyState icon={<HardDrive size={30} />} title={t.docker.noVolumes} />}
    </div>
  )
}
