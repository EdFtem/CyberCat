import { useState } from 'react'
import { FilePen, FolderOpen, Search } from 'lucide-react'
import { useApp, paneTarget, type PaneId } from '@/store/app'
import { pathLib } from '@/lib/paths'
import { formatBytes, formatDate } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { FileIcon } from '@/lib/fileIcons'
import type { SearchHit, SearchResponse } from '@shared/types'
import { Button, Checkbox, Field, IconButton, Modal, Spinner } from '../ui'

export function SearchDialog({ sessionId, pane, close }: { sessionId: string; pane: PaneId; close: () => void }) {
  const t = useT()
  const paneState = useApp((s) => s.ui[sessionId]?.panes[pane])
  const navigate = useApp((s) => s.navigate)
  const setPane = useApp((s) => s.setPane)
  const openDoc = useApp((s) => s.openDoc)
  const target = paneTarget(sessionId, pane)
  const lib = pathLib(target)
  const [root, setRoot] = useState(paneState?.path ?? '')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canRun = (name.trim().length > 0 || content.length > 0) && root.trim().length > 0 && !busy

  const run = async (): Promise<void> => {
    if (!canRun) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.api.search.run({
        target,
        root: root.trim(),
        name: name.trim() || undefined,
        content: content || undefined,
        caseSensitive
      })
      setRes(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const reveal = async (hit: SearchHit): Promise<void> => {
    const dir = lib.dirname(hit.entry.path)
    await navigate(sessionId, pane, dir)
    setPane(sessionId, pane, { selected: [hit.entry.path], cursor: hit.entry.path })
    close()
  }

  const open = (hit: SearchHit): void => {
    if (hit.entry.isDir) void navigate(sessionId, pane, hit.entry.path)
    else void openDoc(sessionId, target, hit.entry.path)
    close()
  }

  const relative = (p: string): string => {
    const r = root.trim()
    if (r && p.startsWith(r)) {
      const rest = p.slice(r.length).replace(/^[\\/]/, '')
      const dir = lib.dirname(rest)
      return dir === '.' || dir === '' || dir === '/' || dir === '\\' ? '' : dir
    }
    return lib.dirname(p)
  }

  return (
    <Modal
      title={pane === 'local' ? t.search.titleLocal : t.search.titleRemote}
      width={820}
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-[12px] text-dim">
            {res && (
              <>
                {t.search.matches(res.hits.length)}
                {res.truncated && ` · ${t.search.truncated}`}
                {res.method === 'walk' && pane !== 'local' && ` · ${t.search.viaSftp}`}
              </>
            )}
          </span>
          <Button onClick={close}>{t.common.close}</Button>
          <Button variant="primary" icon={busy ? <Spinner size={13} /> : <Search size={14} />} onClick={() => void run()} disabled={!canRun}>
            {t.search.run}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.search.name} hint={t.search.nameHint}>
            <input className="input input-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="*.conf" autoFocus spellCheck={false} />
          </Field>
          <Field label={t.search.content} hint={pane === 'local' ? t.search.contentHintLocal : t.search.contentHintRemote}>
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="listen 443" spellCheck={false} />
          </Field>
        </div>
        <div className="flex items-end gap-3">
          <Field label={t.search.root} className="flex-1">
            <input className="input input-mono" value={root} onChange={(e) => setRoot(e.target.value)} spellCheck={false} />
          </Field>
          <Checkbox className="mb-2" checked={caseSensitive} onChange={setCaseSensitive} label={t.search.caseSensitive} />
        </div>
        <button type="submit" className="hidden" />
      </form>

      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}
      {res?.warning && <div className="mt-3 text-[12.5px] text-warning">{res.warning}</div>}

      <div className="mt-3 rounded-md border border-border bg-surface-2 max-h-[380px] overflow-auto">
        {busy && (
          <div className="flex items-center justify-center h-24">
            <Spinner size={22} />
          </div>
        )}
        {!busy && res && res.hits.length === 0 && <div className="p-6 text-center text-[12.5px] text-muted">{t.search.nothingFound}</div>}
        {!busy && !res && <div className="p-6 text-center text-[12.5px] text-dim">{t.search.hint}</div>}
        {!busy &&
          res?.hits.map((hit) => (
            <div key={hit.entry.path} className="group flex items-center gap-3 px-3 py-1.5 border-b border-border/60 last:border-b-0 hover:bg-surface-3" onDoubleClick={() => open(hit)}>
              <FileIcon entry={hit.entry} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[13px] truncate">{highlight(hit.entry.name, name, caseSensitive)}</span>
                  <span className="text-[11.5px] text-dim font-mono truncate">{relative(hit.entry.path)}</span>
                </div>
                {hit.text !== undefined && (
                  <div className="text-[11.5px] font-mono text-muted truncate">
                    <span className="text-dim">{hit.line}: </span>
                    {hit.text}
                  </div>
                )}
              </div>
              <span className="text-[11.5px] text-dim tabular-nums shrink-0 whitespace-nowrap text-right">
                {hit.entry.isDir ? t.common.folder : formatBytes(hit.entry.size)}
                {hit.entry.mtime ? ` · ${formatDate(hit.entry.mtime)}` : ''}
              </span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                <IconButton title={t.search.reveal} size={26} onClick={() => void reveal(hit)}>
                  <FolderOpen size={14} />
                </IconButton>
                <IconButton title={hit.entry.isDir ? t.search.goTo : t.search.openInEditor} size={26} onClick={() => open(hit)}>
                  <FilePen size={14} />
                </IconButton>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  )
}

/** Marks the searched substring in a file name; wildcard patterns are left as they are */
function highlight(fileName: string, query: string, caseSensitive: boolean): React.ReactNode {
  const q = query.trim()
  if (!q || /[*?]/.test(q)) return fileName
  const i = caseSensitive ? fileName.indexOf(q) : fileName.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return fileName
  return (
    <>
      {fileName.slice(0, i)}
      <mark className="bg-accent-soft text-accent rounded-sm">{fileName.slice(i, i + q.length)}</mark>
      {fileName.slice(i + q.length)}
    </>
  )
}
