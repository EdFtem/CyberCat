import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, GitCompareArrows, Minus, Scale } from 'lucide-react'
import { useApp } from '@/store/app'
import { pathLib } from '@/lib/paths'
import { formatBytes, formatDate, countLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CompareEntry, CompareResult, TransferSource } from '@shared/types'
import { Badge, Button, Checkbox, Field, Modal, Segmented, Spinner } from '../ui'

type Direction = 'upload' | 'download' | 'newer'
type Action = 'upload' | 'download' | 'delete-local' | 'delete-remote' | 'skip'

function actionFor(e: CompareEntry, dir: Direction, mirror: boolean): Action {
  if (e.status === 'only-local') {
    if (dir === 'upload' || dir === 'newer') return 'upload'
    return mirror ? 'delete-local' : 'skip'
  }
  if (e.status === 'only-remote') {
    if (dir === 'download' || dir === 'newer') return 'download'
    return mirror ? 'delete-remote' : 'skip'
  }
  if (dir === 'upload') return 'upload'
  if (dir === 'download') return 'download'
  return e.newer === 'remote' ? 'download' : 'upload'
}

const actionLabel: Record<Action, { text: string; icon: React.ReactNode; cls: string }> = {
  upload: { text: 'на сервер', icon: <ArrowRight size={13} />, cls: 'text-accent' },
  download: { text: 'на комп’ютер', icon: <ArrowLeft size={13} />, cls: 'text-success' },
  'delete-local': { text: 'видалити локально', icon: <Minus size={13} />, cls: 'text-danger' },
  'delete-remote': { text: 'видалити на сервері', icon: <Minus size={13} />, cls: 'text-danger' },
  skip: { text: 'пропустити', icon: <Minus size={13} />, cls: 'text-dim' }
}

const reasonLabel: Record<string, string> = { size: 'розмір', mtime: 'дата', hash: 'вміст', type: 'тип' }

export function CompareDialog({ sessionId, close }: { sessionId: string; close: () => void }) {
  const ui = useApp((s) => s.ui[sessionId])
  const pushToast = useApp((s) => s.pushToast)
  const refresh = useApp((s) => s.refresh)
  const [localDir, setLocalDir] = useState(ui?.panes.local.path ?? '')
  const [remoteDir, setRemoteDir] = useState(ui?.panes.remote.path ?? '')
  const [byHash, setByHash] = useState(false)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [res, setRes] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [direction, setDirection] = useState<Direction>('upload')
  const [mirror, setMirror] = useState(false)
  const [watchAfter, setWatchAfter] = useState(false)
  const localLib = pathLib('local')
  const remoteLib = pathLib(sessionId)

  const run = async (): Promise<void> => {
    if (!localDir.trim() || !remoteDir.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.api.compare.run({ sessionId, localDir: localDir.trim(), remoteDir: remoteDir.trim(), byHash })
      setRes(r)
      setSelected(new Set(r.entries.map((e) => e.rel)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const plan = useMemo(() => {
    if (!res) return []
    return res.entries.filter((e) => selected.has(e.rel)).map((e) => ({ e, action: actionFor(e, direction, mirror) }))
  }, [res, selected, direction, mirror])

  const planCounts = useMemo(() => {
    const c: Record<Action, number> = { upload: 0, download: 0, 'delete-local': 0, 'delete-remote': 0, skip: 0 }
    for (const p of plan) c[p.action]++
    return c
  }, [plan])

  const apply = async (): Promise<void> => {
    if (!plan.length) return
    setApplying(true)
    try {
      const uploads = new Map<string, TransferSource[]>()
      const downloads = new Map<string, TransferSource[]>()
      const delLocal: { path: string; isDir: boolean }[] = []
      const delRemote: { path: string; isDir: boolean }[] = []
      for (const { e, action } of plan) {
        const parts = e.rel.split('/')
        const name = parts[parts.length - 1]
        const relDir = parts.slice(0, -1)
        const localPath = localLib.join(localDir, ...parts)
        const remotePath = remoteLib.join(remoteDir, ...parts)
        const isDir = e.kind === 'dir'
        if (action === 'upload') {
          const dest = remoteLib.join(remoteDir, ...relDir)
          if (!uploads.has(dest)) uploads.set(dest, [])
          uploads.get(dest)!.push({ path: localPath, name, isDir })
        } else if (action === 'download') {
          const dest = localLib.join(localDir, ...relDir)
          if (!downloads.has(dest)) downloads.set(dest, [])
          downloads.get(dest)!.push({ path: remotePath, name, isDir })
        } else if (action === 'delete-local') delLocal.push({ path: localPath, isDir })
        else if (action === 'delete-remote') delRemote.push({ path: remotePath, isDir })
      }
      for (const [destDir, sources] of uploads) await window.api.transfer.enqueue({ sessionId, direction: 'upload', sources, destDir, policy: 'overwrite' })
      for (const [destDir, sources] of downloads) await window.api.transfer.enqueue({ sessionId, direction: 'download', sources, destDir, policy: 'overwrite' })
      if (delLocal.length) await window.api.fs.remove('local', delLocal)
      if (delRemote.length) await window.api.fs.remove(sessionId, delRemote)
      if (watchAfter) await window.api.watch.start(sessionId, localDir.trim(), remoteDir.trim())
      pushToast({
        kind: 'success',
        title: 'Синхронізацію запущено',
        message: [
          planCounts.upload && `${planCounts.upload} на сервер`,
          planCounts.download && `${planCounts.download} на комп’ютер`,
          planCounts['delete-local'] + planCounts['delete-remote'] && `${planCounts['delete-local'] + planCounts['delete-remote']} видалено`
        ]
          .filter(Boolean)
          .join(', ')
      })
      void refresh(sessionId, 'local')
      void refresh(sessionId, 'remote')
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const toggle = (rel: string): void =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(rel)) n.delete(rel)
      else n.add(rel)
      return n
    })
  const allSelected = !!res && res.entries.length > 0 && res.entries.every((e) => selected.has(e.rel))

  return (
    <Modal
      title="Порівняння та синхронізація тек"
      subtitle="Локальна тека ліворуч, сервер праворуч. Напрямок визначає, що робити з відмінностями."
      width={960}
      onClose={close}
      footer={
        <>
          {res && (
            <div className="mr-auto flex items-center gap-3 text-[12px] text-dim">
              <span>
                {res.counts.same} однакових · {res.counts.onlyLocal} лише локально · {res.counts.onlyRemote} лише на сервері · {res.counts.different} відмінних
              </span>
              {res.truncated && <Badge tone="warning">список обрізано</Badge>}
            </div>
          )}
          <Button onClick={close}>Закрити</Button>
          <Button variant="primary" icon={<GitCompareArrows size={14} />} onClick={() => void apply()} disabled={!plan.length || applying || busy} loading={applying}>
            Застосувати{plan.length ? ` (${plan.filter((p) => p.action !== 'skip').length})` : ''}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <Field label="Локальна тека">
          <input className="input input-mono" value={localDir} onChange={(e) => setLocalDir(e.target.value)} spellCheck={false} />
        </Field>
        <Field label="Тека на сервері">
          <input className="input input-mono" value={remoteDir} onChange={(e) => setRemoteDir(e.target.value)} spellCheck={false} />
        </Field>
        <Button variant="primary" icon={busy ? <Spinner size={13} /> : <Scale size={14} />} onClick={() => void run()} disabled={busy || !localDir.trim() || !remoteDir.trim()} className="mb-0">
          Порівняти
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[12.5px]">
        <Checkbox checked={byHash} onChange={setByHash} label="Порівнювати вміст за sha256 для файлів однакового розміру (повільніше)" />
      </div>

      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}

      <div className="mt-3 rounded-md border border-border bg-surface-2 max-h-[360px] overflow-auto">
        {busy && (
          <div className="flex items-center justify-center h-28 gap-2 text-[12.5px] text-muted">
            <Spinner size={18} /> Обхід тек…
          </div>
        )}
        {!busy && !res && <div className="p-6 text-center text-[12.5px] text-dim">Натисніть «Порівняти», щоб побачити відмінності</div>}
        {!busy && res && res.entries.length === 0 && <div className="p-6 text-center text-[12.5px] text-success">Теки однакові</div>}
        {!busy && res && res.entries.length > 0 && (
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-dim">
              <tr>
                <th className="px-2 py-1.5 text-left w-8">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(res.entries.map((e) => e.rel)))} />
                </th>
                <th className="px-2 py-1.5 text-left">Шлях</th>
                <th className="px-2 py-1.5 text-right">Локально</th>
                <th className="px-2 py-1.5 text-right">На сервері</th>
                <th className="px-2 py-1.5 text-left">Відмінність</th>
                <th className="px-2 py-1.5 text-left">Дія</th>
              </tr>
            </thead>
            <tbody>
              {res.entries.map((e) => {
                const on = selected.has(e.rel)
                const act = on ? actionFor(e, direction, mirror) : 'skip'
                const al = actionLabel[act]
                return (
                  <tr key={e.rel} className={cn('border-t border-border/60 hover:bg-surface-3', !on && 'opacity-50')}>
                    <td className="px-2 py-1">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} onChange={() => toggle(e.rel)} />
                    </td>
                    <td className="px-2 py-1 font-mono truncate max-w-[320px]" title={e.rel}>
                      {e.rel}
                      {e.kind === 'dir' && <span className="text-dim">/</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted whitespace-nowrap">
                      {e.local ? (e.kind === 'dir' ? 'тека' : `${formatBytes(e.local.size)} · ${formatDate(e.local.mtime)}`) : <span className="text-dim">немає</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted whitespace-nowrap">
                      {e.remote ? (e.kind === 'dir' ? 'тека' : `${formatBytes(e.remote.size)} · ${formatDate(e.remote.mtime)}`) : <span className="text-dim">немає</span>}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {e.status === 'only-local' && <Badge tone="accent">лише локально</Badge>}
                      {e.status === 'only-remote' && <Badge tone="success">лише на сервері</Badge>}
                      {e.status === 'different' && (
                        <Badge tone="warning">
                          {reasonLabel[e.reason ?? ''] ?? 'відмінний'}
                          {e.newer && `, новіший ${e.newer === 'local' ? 'локально' : 'на сервері'}`}
                        </Badge>
                      )}
                    </td>
                    <td className={cn('px-2 py-1 whitespace-nowrap', al.cls)}>
                      <span className="inline-flex items-center gap-1">
                        {al.icon} {al.text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'upload', label: 'Локально → сервер', icon: <ArrowRight size={13} /> },
            { value: 'download', label: 'Сервер → локально', icon: <ArrowLeft size={13} /> },
            { value: 'newer', label: 'Новіше перемагає' }
          ]}
        />
        <Checkbox checked={mirror} onChange={setMirror} disabled={direction === 'newer'} label="Дзеркало: видаляти у призначенні те, чого немає у джерелі" />
        <Checkbox checked={watchAfter} onChange={setWatchAfter} label={<span className="inline-flex items-center gap-1"><Eye size={13} /> Далі стежити за локальною текою і відвантажувати зміни</span>} />
      </div>
      {plan.length > 0 && (
        <div className="mt-2 text-[12px] text-dim">
          План: {countLabel(planCounts.upload, 'файл', 'файли', 'файлів')} на сервер, {planCounts.download} на комп’ютер
          {planCounts['delete-local'] + planCounts['delete-remote'] > 0 && `, ${planCounts['delete-local'] + planCounts['delete-remote']} видалити`}
          {planCounts.skip > 0 && `, ${planCounts.skip} пропустити`}
        </div>
      )}
    </Modal>
  )
}
