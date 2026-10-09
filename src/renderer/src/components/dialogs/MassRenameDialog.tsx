import { useMemo, useState } from 'react'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { useApp, paneTarget, type PaneId } from '@/store/app'
import { pathLib } from '@/lib/paths'
import { countLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { FileEntry } from '@shared/types'
import { Button, Checkbox, Field, Modal, Segmented } from '../ui'

type Mode = 'replace' | 'template'

function splitName(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.')
  if (i <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, i), ext: name.slice(i) }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function dateOf(ms: number): string {
  const d = new Date(ms || Date.now())
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`
}

export function MassRenameDialog({ sessionId, pane, entries, close }: { sessionId: string; pane: PaneId; entries: FileEntry[]; close: () => void }) {
  const refresh = useApp((s) => s.refresh)
  const setPane = useApp((s) => s.setPane)
  const pushToast = useApp((s) => s.pushToast)
  const siblings = useApp((s) => s.ui[sessionId]?.panes[pane].entries ?? [])
  const target = paneTarget(sessionId, pane)
  const lib = pathLib(target)
  const [mode, setMode] = useState<Mode>('replace')
  const [find, setFind] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(true)
  const [template, setTemplate] = useState('{name}{ext}')
  const [start, setStart] = useState(1)
  const [width, setWidth] = useState(2)
  const [lower, setLower] = useState(false)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => {
    let re: RegExp | null = null
    let regexError: string | null = null
    if (mode === 'replace' && find) {
      try {
        re = new RegExp(useRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), `g${ignoreCase ? 'i' : ''}`)
      } catch (e) {
        regexError = e instanceof Error ? e.message : String(e)
      }
    }
    const siblingNames = new Set(siblings.map((s) => s.name))
    const selectedNames = new Set(entries.map((e) => e.name))
    const seen = new Map<string, number>()
    const rows = entries.map((e, i) => {
      const { base, ext } = splitName(e.name)
      let next = e.name
      if (mode === 'replace') {
        if (re) next = e.name.replace(re, replaceWith)
      } else {
        next = template
          .replace(/\{name\}/g, base)
          .replace(/\{ext\}/g, ext)
          .replace(/\{n\}/g, pad(start + i, width))
          .replace(/\{date\}/g, dateOf(e.mtime))
      }
      if (lower) next = next.toLowerCase()
      next = next.trim()
      seen.set(next, (seen.get(next) ?? 0) + 1)
      return { entry: e, next }
    })
    return {
      regexError,
      rows: rows.map((r) => {
        let problem: string | null = null
        if (!r.next || r.next === '.' || r.next === '..') problem = 'порожня назва'
        else if (/[/\\]/.test(r.next)) problem = 'містить / або \\'
        else if ((seen.get(r.next) ?? 0) > 1) problem = 'дублікат у списку'
        else if (r.next !== r.entry.name && siblingNames.has(r.next) && !selectedNames.has(r.next)) problem = 'файл уже існує'
        return { ...r, changed: r.next !== r.entry.name, problem }
      })
    }
  }, [entries, siblings, mode, find, replaceWith, useRegex, ignoreCase, template, start, width, lower])

  const toApply = preview.rows.filter((r) => r.changed && !r.problem)
  const hasProblems = preview.rows.some((r) => r.changed && r.problem)

  const apply = async (): Promise<void> => {
    if (!toApply.length || hasProblems) return
    setBusy(true)
    const errors: string[] = []
    const renamed: string[] = []
    for (const r of toApply) {
      const to = lib.join(lib.dirname(r.entry.path), r.next)
      try {
        await window.api.fs.rename(target, r.entry.path, to)
        renamed.push(to)
      } catch (e) {
        errors.push(`${r.entry.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    await refresh(sessionId, pane)
    if (renamed.length) setPane(sessionId, pane, { selected: renamed, cursor: renamed[0] })
    if (errors.length) pushToast({ kind: 'error', title: 'Не все вдалося перейменувати', message: errors.join('\n') })
    else pushToast({ kind: 'success', title: 'Перейменовано', message: countLabel(renamed.length, 'елемент', 'елементи', 'елементів') })
    setBusy(false)
    close()
  }

  return (
    <Modal
      title={`Масове перейменування · ${countLabel(entries.length, 'елемент', 'елементи', 'елементів')}`}
      width={760}
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-[12px] text-dim">
            {toApply.length ? `Зміниться ${toApply.length}` : 'Немає змін'}
            {hasProblems && ' · є конфлікти'}
          </span>
          <Button onClick={close}>Скасувати</Button>
          <Button variant="primary" onClick={() => void apply()} disabled={!toApply.length || hasProblems || !!preview.regexError} loading={busy}>
            Перейменувати
          </Button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'replace', label: 'Знайти і замінити' },
          { value: 'template', label: 'За шаблоном' }
        ]}
      />

      {mode === 'replace' ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Знайти" error={preview.regexError}>
            <input className="input input-mono" value={find} onChange={(e) => setFind(e.target.value)} autoFocus spellCheck={false} placeholder={useRegex ? '^(\\d+)-' : 'draft'} />
          </Field>
          <Field label="Замінити на" hint={useRegex ? 'Групи доступні як $1, $2' : undefined}>
            <input className="input input-mono" value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} spellCheck={false} placeholder={useRegex ? '$1_' : 'final'} />
          </Field>
          <div className="col-span-2 flex flex-wrap gap-5">
            <Checkbox checked={useRegex} onChange={setUseRegex} label="Регулярний вираз" />
            <Checkbox checked={ignoreCase} onChange={setIgnoreCase} label="Без урахування регістру" />
            <Checkbox checked={lower} onChange={setLower} label="Усе в нижній регістр" />
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_110px_110px] gap-3">
          <Field label="Шаблон" hint="{name} ім'я без розширення, {ext} розширення з крапкою, {n} номер, {date} дата зміни">
            <input className="input input-mono" value={template} onChange={(e) => setTemplate(e.target.value)} autoFocus spellCheck={false} />
          </Field>
          <Field label="Початок {n}">
            <input className="input input-mono" type="number" value={start} onChange={(e) => setStart(Number(e.target.value) || 0)} />
          </Field>
          <Field label="Розрядів">
            <input className="input input-mono" type="number" min={1} max={6} value={width} onChange={(e) => setWidth(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
          </Field>
          <div className="col-span-3 flex gap-5">
            <Checkbox checked={lower} onChange={setLower} label="Усе в нижній регістр" />
          </div>
        </div>
      )}

      <div className="mt-3 rounded-md border border-border bg-surface-2 max-h-[300px] overflow-auto">
        {preview.rows.map((r) => (
          <div key={r.entry.path} className={cn('flex items-center gap-2 px-3 py-1.5 border-b border-border/60 last:border-b-0 text-[12.5px] font-mono', !r.changed && 'text-dim')}>
            <span className="truncate flex-1" title={r.entry.name}>
              {r.entry.name}
            </span>
            <ArrowRight size={13} className={r.changed ? 'text-accent' : 'text-dim'} />
            <span className={cn('truncate flex-1', r.problem ? 'text-danger' : r.changed ? 'text-text' : '')} title={r.next}>
              {r.next}
            </span>
            {r.problem && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-danger font-sans shrink-0">
                <TriangleAlert size={12} /> {r.problem}
              </span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
