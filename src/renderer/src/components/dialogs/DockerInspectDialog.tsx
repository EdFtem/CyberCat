import { useEffect, useState } from 'react'
import { Code2, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { useApp } from '@/store/app'
import { formatDateFull } from '@/lib/format'
import type { DockerContainer } from '@shared/types'
import { Badge, Button, Checkbox, Modal, Spinner } from '../ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const SECRET_RE = /pass|secret|token|key|pwd|credential/i

export function DockerInspectDialog({ sessionId, container, close }: { sessionId: string; container: DockerContainer; close: () => void }) {
  const navigate = useApp((s) => s.navigate)
  const setDockerOpen = useApp((s) => s.setDockerOpen)
  const [data, setData] = useState<Json | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  useEffect(() => {
    let disposed = false
    window.api.docker
      .inspect(sessionId, container.id)
      .then((d) => !disposed && setData(d))
      .catch((e) => !disposed && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      disposed = true
    }
  }, [sessionId, container.id])

  const openOnHost = async (source: string): Promise<void> => {
    let dir = source
    try {
      const st = await window.api.fs.stat(sessionId, source)
      if (!st.isDir) dir = source.slice(0, source.lastIndexOf('/')) || '/'
    } catch {
      dir = source.slice(0, source.lastIndexOf('/')) || '/'
    }
    setDockerOpen(sessionId, false)
    await navigate(sessionId, 'remote', dir)
    close()
  }

  const state = data?.State ?? {}
  const config = data?.Config ?? {}
  const host = data?.HostConfig ?? {}
  const net = data?.NetworkSettings ?? {}
  const mounts: Json[] = data?.Mounts ?? []
  const env: string[] = config.Env ?? []
  const labels: Record<string, string> = config.Labels ?? {}
  const ports: Record<string, Json[] | null> = net.Ports ?? {}

  return (
    <Modal
      title={container.name}
      subtitle={<span className="font-mono text-[12px]">{container.image}</span>}
      width={860}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" icon={<Code2 size={14} />} onClick={() => setRaw((r) => !r)} className="mr-auto">
            {raw ? 'Структуровано' : 'JSON'}
          </Button>
          <Button variant="primary" onClick={close}>
            Закрити
          </Button>
        </>
      }
    >
      {error && <div className="text-[12.5px] text-danger">{error}</div>}
      {!data && !error && (
        <div className="flex items-center justify-center h-32">
          <Spinner size={22} />
        </div>
      )}
      {data && raw && (
        <pre className="rounded-md border border-border bg-surface-2 p-3 text-[11.5px] font-mono max-h-[480px] overflow-auto select-text whitespace-pre">{JSON.stringify(data, null, 2)}</pre>
      )}
      {data && !raw && (
        <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
          <Section title="Загальне">
            <Row k="ID">
              <span className="font-mono select-text">{container.id}</span>
            </Row>
            <Row k="Стан">
              <span className="inline-flex items-center gap-2">
                <Badge tone={state.Running ? 'success' : state.Paused ? 'warning' : 'neutral'}>{state.Status}</Badge>
                {state.Health?.Status && <Badge tone={state.Health.Status === 'healthy' ? 'success' : 'danger'}>{state.Health.Status}</Badge>}
                {typeof state.ExitCode === 'number' && !state.Running && <span className="text-dim">код виходу {state.ExitCode}</span>}
              </span>
            </Row>
            <Row k="Запущено">{state.StartedAt && !state.StartedAt.startsWith('0001') ? formatDateFull(Date.parse(state.StartedAt)) : '—'}</Row>
            <Row k="Створено">{data.Created ? formatDateFull(Date.parse(data.Created)) : '—'}</Row>
            <Row k="Команда">
              <span className="font-mono text-[12px] select-text break-all">{[data.Path, ...(data.Args ?? [])].filter(Boolean).join(' ')}</span>
            </Row>
            <Row k="Рестарти">
              {data.RestartCount ?? 0} · політика {host.RestartPolicy?.Name || 'no'}
            </Row>
            {config.WorkingDir && <Row k="Робоча тека">{config.WorkingDir}</Row>}
            {config.User && <Row k="Користувач">{config.User}</Row>}
          </Section>

          <Section title="Порти">
            {Object.keys(ports).length === 0 && <div className="text-dim text-[12.5px]">Немає</div>}
            {Object.entries(ports).map(([cport, bindings]) => (
              <Row key={cport} k={cport}>
                {bindings && bindings.length ? bindings.map((b: Json) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(', ') : <span className="text-dim">не опубліковано</span>}
              </Row>
            ))}
          </Section>

          <Section title="Монтування">
            {mounts.length === 0 && <div className="text-dim text-[12.5px]">Немає</div>}
            {mounts.map((m: Json, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px] py-1 border-b border-border/50 last:border-b-0">
                <Badge tone={m.Type === 'volume' ? 'accent' : 'neutral'}>{m.Type}</Badge>
                <span className="font-mono truncate flex-1 select-text" title={m.Source}>
                  {m.Type === 'volume' ? m.Name : m.Source}
                </span>
                <span className="text-dim">→</span>
                <span className="font-mono truncate flex-1 select-text" title={m.Destination}>
                  {m.Destination}
                </span>
                <span className="text-dim text-[11px]">{m.RW ? 'rw' : 'ro'}</span>
                {m.Source && (
                  <Button size="sm" variant="ghost" icon={<FolderOpen size={13} />} onClick={() => void openOnHost(m.Source)} title="Відкрити теку на хості у панелі">
                    На хості
                  </Button>
                )}
              </div>
            ))}
          </Section>

          <Section title="Мережі">
            {Object.entries(net.Networks ?? {}).map(([name, n]: [string, Json]) => (
              <Row key={name} k={name}>
                <span className="font-mono">{n.IPAddress || '—'}</span>
                {n.Gateway && <span className="text-dim"> · шлюз {n.Gateway}</span>}
                {n.Aliases?.length ? <span className="text-dim"> · {n.Aliases.join(', ')}</span> : null}
              </Row>
            ))}
          </Section>

          <Section
            title="Середовище"
            right={<Checkbox checked={showSecrets} onChange={setShowSecrets} label={<span className="inline-flex items-center gap-1 text-[12px]">{showSecrets ? <EyeOff size={12} /> : <Eye size={12} />} показувати секрети</span>} />}
          >
            {env.length === 0 && <div className="text-dim text-[12.5px]">Немає</div>}
            <div className="font-mono text-[12px] space-y-0.5">
              {env.map((e: string, i: number) => {
                const idx = e.indexOf('=')
                const k = idx >= 0 ? e.slice(0, idx) : e
                const v = idx >= 0 ? e.slice(idx + 1) : ''
                const hidden = !showSecrets && SECRET_RE.test(k)
                return (
                  <div key={i} className="truncate select-text">
                    <span className="text-accent">{k}</span>=<span className={hidden ? 'text-dim' : ''}>{hidden ? '••••••••' : v}</span>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Мітки">
            {Object.keys(labels).length === 0 && <div className="text-dim text-[12.5px]">Немає</div>}
            <div className="font-mono text-[11.5px] space-y-0.5">
              {Object.entries(labels).map(([k, v]) => (
                <div key={k} className="truncate select-text" title={`${k}=${v}`}>
                  <span className="text-muted">{k}</span>=<span>{v}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </Modal>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[11px] uppercase tracking-wide text-dim">{title}</h3>
        {right}
      </div>
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2">{children}</div>
    </section>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 text-[12.5px] py-0.5">
      <span className="text-dim truncate" title={k}>
        {k}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
