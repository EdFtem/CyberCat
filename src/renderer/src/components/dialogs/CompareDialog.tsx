import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, GitCompareArrows, Minus, Scale } from 'lucide-react'
import { useApp } from '@/store/app'
import { pathLib } from '@/lib/paths'
import { formatBytes, formatDate } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { CompareEntry, CompareResult, TransferSource } from '@shared/types'
import type { Messages } from '@shared/i18n'
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

const actionLabel: Record<Action, { text: (t: Messages) => string; icon: React.ReactNode; cls: string }> = {
  upload: { text: (t) => t.compare.actions.upload, icon: <ArrowRight size={13} />, cls: 'text-accent' },
  download: { text: (t) => t.compare.actions.download, icon: <ArrowLeft size={13} />, cls: 'text-success' },
  'delete-local': { text: (t) => t.compare.actions.deleteLocal, icon: <Minus size={13} />, cls: 'text-danger' },
  'delete-remote': { text: (t) => t.compare.actions.deleteRemote, icon: <Minus size={13} />, cls: 'text-danger' },
  skip: { text: (t) => t.compare.actions.skip, icon: <Minus size={13} />, cls: 'text-dim' }
}

function reasonLabel(t: Messages, e: CompareEntry): string {
  const reason = (e.reason && t.compare.reasons[e.reason]) || t.compare.different
  if (e.newer === 'local') return t.compare.newerLocal(reason)
  if (e.newer === 'remote') return t.compare.newerRemote(reason)
  return reason
}

export function CompareDialog({ sessionId, close }: { sessionId: string; close: () => void }) {
  const t = useT()
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
        title: t.compare.syncStarted,
        message: t.compare.syncSummary({
          upload: planCounts.upload,
          download: planCounts.download,
          deleted: planCounts['delete-local'] + planCounts['delete-remote']
        })
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
      title={t.compare.title}
      subtitle={t.compare.subtitle}
      width={960}
      onClose={close}
      footer={
        <>
          {res && (
            <div className="mr-auto flex items-center gap-3 text-[12px] text-dim">
              <span>{t.compare.summary(res.counts)}</span>
              {res.truncated && <Badge tone="warning">{t.compare.truncated}</Badge>}
            </div>
          )}
          <Button onClick={close}>{t.common.close}</Button>
          <Button variant="primary" icon={<GitCompareArrows size={14} />} onClick={() => void apply()} disabled={!plan.length || applying || busy} loading={applying}>
            {t.common.apply}
            {plan.length ? ` (${plan.filter((p) => p.action !== 'skip').length})` : ''}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <Field label={t.compare.localDir}>
          <input className="input input-mono" value={localDir} onChange={(e) => setLocalDir(e.target.value)} spellCheck={false} />
        </Field>
        <Field label={t.compare.remoteDir}>
          <input className="input input-mono" value={remoteDir} onChange={(e) => setRemoteDir(e.target.value)} spellCheck={false} />
        </Field>
        <Button variant="primary" icon={busy ? <Spinner size={13} /> : <Scale size={14} />} onClick={() => void run()} disabled={busy || !localDir.trim() || !remoteDir.trim()} className="mb-0">
          {t.compare.run}
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[12.5px]">
        <Checkbox checked={byHash} onChange={setByHash} label={t.compare.byHash} />
      </div>

      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}

      <div className="mt-3 rounded-md border border-border bg-surface-2 max-h-[360px] overflow-auto">
        {busy && (
          <div className="flex items-center justify-center h-28 gap-2 text-[12.5px] text-muted">
            <Spinner size={18} /> {t.compare.scanning}
          </div>
        )}
        {!busy && !res && <div className="p-6 text-center text-[12.5px] text-dim">{t.compare.hint}</div>}
        {!busy && res && res.entries.length === 0 && <div className="p-6 text-center text-[12.5px] text-success">{t.compare.identical}</div>}
        {!busy && res && res.entries.length > 0 && (
          // Fixed layout: the path column takes what is left and truncates, so Action never gets clipped
          <table className="w-full table-fixed text-[12.5px]">
            <colgroup>
              <col className="w-9" />
              <col />
              <col className="w-[190px]" />
              <col className="w-[190px]" />
              <col className="w-[176px]" />
              <col className="w-[128px]" />
            </colgroup>
            <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-dim">
              <tr>
                <th className="px-2 py-1.5 text-left">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(res.entries.map((e) => e.rel)))} />
                </th>
                <th className="px-2 py-1.5 text-left">{t.compare.colPath}</th>
                <th className="px-2 py-1.5 text-right">{t.compare.colLocal}</th>
                <th className="px-2 py-1.5 text-right">{t.compare.colRemote}</th>
                <th className="px-2 py-1.5 text-left">{t.compare.colDiff}</th>
                <th className="px-2 py-1.5 text-left">{t.compare.colAction}</th>
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
                    <td className="px-2 py-1 font-mono truncate" title={e.rel}>
                      {e.rel}
                      {e.kind === 'dir' && <span className="text-dim">/</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted whitespace-nowrap">
                      {e.local ? (e.kind === 'dir' ? t.common.folder : `${formatBytes(e.local.size)} · ${formatDate(e.local.mtime)}`) : <span className="text-dim">{t.compare.missing}</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted whitespace-nowrap">
                      {e.remote ? (e.kind === 'dir' ? t.common.folder : `${formatBytes(e.remote.size)} · ${formatDate(e.remote.mtime)}`) : <span className="text-dim">{t.compare.missing}</span>}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap truncate">
                      {e.status === 'only-local' && <Badge tone="accent">{t.compare.onlyLocal}</Badge>}
                      {e.status === 'only-remote' && <Badge tone="success">{t.compare.onlyRemote}</Badge>}
                      {e.status === 'different' && <Badge tone="warning">{reasonLabel(t, e)}</Badge>}
                    </td>
                    <td className={cn('px-2 py-1 whitespace-nowrap truncate', al.cls)}>
                      <span className="inline-flex items-center gap-1">
                        {al.icon} {al.text(t)}
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
            { value: 'upload', label: t.compare.dirUpload, icon: <ArrowRight size={13} /> },
            { value: 'download', label: t.compare.dirDownload, icon: <ArrowLeft size={13} /> },
            { value: 'newer', label: t.compare.dirNewer }
          ]}
        />
        <Checkbox checked={mirror} onChange={setMirror} disabled={direction === 'newer'} label={t.compare.mirror} />
        <Checkbox checked={watchAfter} onChange={setWatchAfter} label={<span className="inline-flex items-center gap-1"><Eye size={13} /> {t.compare.watchAfter}</span>} />
      </div>
      {plan.length > 0 && (
        <div className="mt-2 text-[12px] text-dim">
          {t.compare.plan({
            upload: planCounts.upload,
            download: planCounts.download,
            delete: planCounts['delete-local'] + planCounts['delete-remote'],
            skip: planCounts.skip
          })}
        </div>
      )}
    </Modal>
  )
}
