import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, CornerDownRight, FolderOpen } from 'lucide-react'
import { useApp, paneTarget, otherPane, type PaneId, type SortKey } from '@/store/app'
import { ops, selectedEntries } from '@/lib/ops'
import { formatBytes, formatDate, modeToString } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { FileIcon } from '@/lib/fileIcons'
import { pathLib } from '@/lib/paths'
import { cn } from '@/lib/cn'
import type { FileEntry } from '@shared/types'
import { Spinner, EmptyState } from '../ui'

const ROW = 30
const OVERSCAN = 8

/** Current internal drag (between panes) */
let currentDrag: { sid: string; pane: PaneId; entries: FileEntry[] } | null = null
export function getCurrentDrag(): typeof currentDrag {
  return currentDrag
}

export function listElementId(sid: string, pane: PaneId): string {
  return `filelist-${sid}-${pane}`
}

export function focusPane(sid: string, pane: PaneId): void {
  document.getElementById(listElementId(sid, pane))?.focus()
}

function compare(a: FileEntry, b: FileEntry, key: SortKey, dir: 'asc' | 'desc'): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
  let r = 0
  if (key === 'name') r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  else if (key === 'size') r = a.size - b.size
  else if (key === 'mtime') r = a.mtime - b.mtime
  else if (key === 'mode') r = a.mode - b.mode
  if (r === 0) r = a.name.localeCompare(b.name, undefined, { numeric: true })
  return dir === 'asc' ? r : -r
}

export function useVisibleEntries(sid: string, pane: PaneId): FileEntry[] {
  const entries = useApp((s) => s.ui[sid]?.panes[pane].entries)
  const filter = useApp((s) => s.ui[sid]?.panes[pane].filter ?? '')
  const sortKey = useApp((s) => s.ui[sid]?.panes[pane].sortKey ?? 'name')
  const sortDir = useApp((s) => s.ui[sid]?.panes[pane].sortDir ?? 'asc')
  const showHidden = useApp((s) => s.settings.showHidden)
  return useMemo(() => {
    if (!entries) return []
    const f = filter.trim().toLowerCase()
    const list = entries.filter((e) => (showHidden || !e.name.startsWith('.') || e.isDrive) && (!f || e.name.toLowerCase().includes(f)))
    return list.sort((a, b) => compare(a, b, sortKey, sortDir))
  }, [entries, filter, sortKey, sortDir, showHidden])
}

export function FileList({
  sid,
  pane,
  onContextMenu
}: {
  sid: string
  pane: PaneId
  onContextMenu: (e: React.MouseEvent, entry: FileEntry | null) => void
}) {
  const t = useT()
  const paneState = useApp((s) => s.ui[sid]?.panes[pane])
  const setPane = useApp((s) => s.setPane)
  const setActivePane = useApp((s) => s.setActivePane)
  const goUp = useApp((s) => s.goUp)
  const refresh = useApp((s) => s.refresh)
  const updateSettings = useApp((s) => s.updateSettings)
  const showHidden = useApp((s) => s.settings.showHidden)
  const visible = useVisibleEntries(sid, pane)
  const target = paneTarget(sid, pane)
  const isRemote = pane === 'remote'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [width, setWidth] = useState(800)
  const [dropRow, setDropRow] = useState<string | null>(null)
  const typeahead = useRef({ text: '', t: 0 })

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = (): void => {
      setHeight(el.clientHeight)
      setWidth(el.clientWidth)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  const selectedSet = useMemo(() => new Set(paneState?.selected ?? []), [paneState?.selected])

  const indexOf = useCallback((path?: string) => (path ? visible.findIndex((e) => e.path === path) : -1), [visible])

  const ensureVisible = useCallback((idx: number) => {
    const el = scrollRef.current
    if (!el || idx < 0) return
    const top = idx * ROW
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight
  }, [])

  const select = useCallback(
    (entry: FileEntry, mode: 'single' | 'toggle' | 'range') => {
      if (!paneState) return
      if (mode === 'single') setPane(sid, pane, { selected: [entry.path], cursor: entry.path, anchor: entry.path })
      else if (mode === 'toggle') {
        const next = selectedSet.has(entry.path) ? paneState.selected.filter((p) => p !== entry.path) : [...paneState.selected, entry.path]
        setPane(sid, pane, { selected: next, cursor: entry.path, anchor: entry.path })
      } else {
        const a = indexOf(paneState.anchor ?? paneState.cursor)
        const b = indexOf(entry.path)
        if (a < 0 || b < 0) return select(entry, 'single')
        const [from, to] = a < b ? [a, b] : [b, a]
        setPane(sid, pane, { selected: visible.slice(from, to + 1).map((e) => e.path), cursor: entry.path })
      }
    },
    [paneState, selectedSet, visible, indexOf, setPane, sid, pane]
  )

  const moveCursor = useCallback(
    (delta: number | 'home' | 'end', extend: boolean) => {
      if (!visible.length) return
      const cur = indexOf(paneState?.cursor)
      let next: number
      if (delta === 'home') next = 0
      else if (delta === 'end') next = visible.length - 1
      else next = cur < 0 ? (delta > 0 ? 0 : visible.length - 1) : Math.max(0, Math.min(visible.length - 1, cur + delta))
      const entry = visible[next]
      select(entry, extend ? 'range' : 'single')
      ensureVisible(next)
    },
    [visible, indexOf, paneState?.cursor, select, ensureVisible]
  )

  const cursorEntry = useMemo(() => visible.find((e) => e.path === paneState?.cursor), [visible, paneState?.cursor])
  const selEntries = useMemo(() => (paneState ? selectedEntries({ ...paneState, entries: visible }) : []), [paneState, visible])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!paneState) return
    if (paneState.renaming) return
    const ctrl = e.ctrlKey || e.metaKey
    const pageRows = Math.max(1, Math.floor(height / ROW) - 1)
    const actOn = selEntries.length ? selEntries : cursorEntry ? [cursorEntry] : []

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveCursor(1, e.shiftKey)
        return
      case 'ArrowUp':
        e.preventDefault()
        moveCursor(-1, e.shiftKey)
        return
      case 'PageDown':
        e.preventDefault()
        moveCursor(pageRows, e.shiftKey)
        return
      case 'PageUp':
        e.preventDefault()
        moveCursor(-pageRows, e.shiftKey)
        return
      case 'Home':
        e.preventDefault()
        moveCursor('home', e.shiftKey)
        return
      case 'End':
        e.preventDefault()
        moveCursor('end', e.shiftKey)
        return
      case 'Enter':
        e.preventDefault()
        if (cursorEntry) ops.openEntry(sid, pane, cursorEntry)
        return
      case 'Backspace':
        e.preventDefault()
        goUp(sid, pane)
        return
      case ' ':
        e.preventDefault()
        if (cursorEntry) select(cursorEntry, 'toggle')
        return
      case 'Escape':
        e.preventDefault()
        if (paneState.filter) setPane(sid, pane, { filter: '', filterOpen: false })
        else setPane(sid, pane, { selected: [], anchor: undefined })
        return
      case 'Tab':
        e.preventDefault()
        setActivePane(sid, otherPane(pane))
        focusPane(sid, otherPane(pane))
        return
      case 'F2':
        e.preventDefault()
        if (cursorEntry && !cursorEntry.isDrive) setPane(sid, pane, { renaming: cursorEntry.path })
        return
      case 'F3':
        e.preventDefault()
        if (cursorEntry) ops.editInternal(sid, pane, cursorEntry)
        return
      case 'F4':
        e.preventDefault()
        if (cursorEntry) (e.shiftKey ? ops.editExternal : ops.editInternal)(sid, pane, cursorEntry)
        return
      case 'F5':
        e.preventDefault()
        if (ctrl) void refresh(sid, pane)
        else ops.transfer(sid, pane, actOn)
        return
      case 'F6':
        e.preventDefault()
        if (e.shiftKey) ops.moveTo(sid, pane, actOn)
        else ops.moveToOtherPane(sid, pane, actOn)
        return
      case 'F7':
        e.preventDefault()
        ops.mkdir(sid, pane)
        return
      case 'F8':
      case 'Delete':
        e.preventDefault()
        ops.deleteEntries(sid, pane, actOn.filter((x) => !x.isDrive))
        return
      default:
        break
    }
    if (ctrl && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      setPane(sid, pane, { selected: visible.map((x) => x.path) })
      return
    }
    if (ctrl && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      void refresh(sid, pane)
      return
    }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      ops.copyPath(actOn)
      return
    }
    if (ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      ops.copyToClipboard(sid, pane, actOn, false)
      return
    }
    if (ctrl && e.key.toLowerCase() === 'x') {
      e.preventDefault()
      ops.copyToClipboard(sid, pane, actOn, true)
      return
    }
    if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault()
      void ops.paste(sid, pane)
      return
    }
    if (ctrl && e.key.toLowerCase() === 'h') {
      e.preventDefault()
      void updateSettings({ showHidden: !showHidden })
      return
    }
    if (ctrl && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      if (e.shiftKey) ops.createFile(sid, pane)
      else ops.mkdir(sid, pane)
      return
    }
    // Type-ahead: jump to the first entry starting with the typed letters
    if (!ctrl && !e.altKey && e.key.length === 1) {
      const now = Date.now()
      const ta = typeahead.current
      ta.text = now - ta.t < 800 ? ta.text + e.key : e.key
      ta.t = now
      const q = ta.text.toLowerCase()
      const start = ta.text.length === 1 ? indexOf(paneState.cursor) + 1 : 0
      const order = [...visible.slice(start), ...visible.slice(0, start)]
      const hit = order.find((x) => x.name.toLowerCase().startsWith(q))
      if (hit) {
        select(hit, 'single')
        ensureVisible(indexOf(hit.path))
      }
    }
  }

  // ---- Drag and drop
  const onRowDragStart = (e: React.DragEvent, entry: FileEntry): void => {
    if (entry.isDrive) {
      e.preventDefault()
      return
    }
    const entries = selectedSet.has(entry.path) && selEntries.length ? selEntries : [entry]
    if (!selectedSet.has(entry.path)) select(entry, 'single')
    currentDrag = { sid, pane, entries }
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('application/x-cybercat', JSON.stringify({ sid, pane, paths: entries.map((x) => x.path) }))
    e.dataTransfer.setData('text/plain', entries.map((x) => x.path).join('\n'))
  }
  const onRowDragEnd = (): void => {
    currentDrag = null
    setDropRow(null)
  }
  const canAcceptDrag = (e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('application/x-cybercat')) return true
    if (types.includes('Files')) return isRemote
    return false
  }
  const onRowDragOver = (e: React.DragEvent, entry: FileEntry): void => {
    if (!entry.isDir || !canAcceptDrag(e)) return
    const d = currentDrag
    if (d && d.entries.some((x) => x.path === entry.path)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = d && d.pane === pane && d.sid === sid ? 'move' : 'copy'
    if (dropRow !== entry.path) setDropRow(entry.path)
  }
  const onRowDrop = async (e: React.DragEvent, entry: FileEntry): Promise<void> => {
    if (!entry.isDir) return
    e.preventDefault()
    e.stopPropagation()
    setDropRow(null)
    const d = currentDrag
    currentDrag = null
    if (d) {
      if (d.sid === sid && d.pane === pane) {
        // Move within the same pane
        const lib = pathLib(target)
        const errors: string[] = []
        for (const src of d.entries) {
          try {
            await window.api.fs.rename(target, src.path, lib.join(entry.path, src.name))
          } catch (err) {
            errors.push(`${src.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
        if (errors.length) useApp.getState().pushToast({ kind: 'error', title: t.ops.moveSomeFailed, message: errors.join('\n') })
        void refresh(sid, pane)
      } else {
        ops.transfer(sid, d.pane, d.entries, entry.path)
      }
      return
    }
    if (e.dataTransfer.files.length && isRemote) {
      void ops.uploadOsFiles(sid, Array.from(e.dataTransfer.files), entry.path)
    }
  }

  if (!paneState) return null

  const total = visible.length
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN)
  const endIdx = Math.min(total, Math.ceil((scrollTop + height) / ROW) + OVERSCAN)
  const slice = visible.slice(startIdx, endIdx)
  // Narrow panes keep the name readable by dropping secondary columns first
  const cols: Columns = {
    owner: isRemote && width >= 620,
    mode: width >= 500,
    mtime: width >= 380
  }
  const gridCols = ['minmax(0,1fr)', '76px', cols.mtime && '128px', cols.mode && '92px', cols.owner && '110px'].filter(Boolean).join(' ')

  const toggleSort = (key: SortKey): void => {
    if (paneState.sortKey === key) setPane(sid, pane, { sortDir: paneState.sortDir === 'asc' ? 'desc' : 'asc' })
    else setPane(sid, pane, { sortKey: key, sortDir: key === 'mtime' ? 'desc' : 'asc' })
  }

  const Header = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn('flex items-center gap-1 h-full text-[11.5px] uppercase tracking-wide text-dim hover:text-text truncate', align === 'right' && 'justify-end')}
    >
      {children}
      {paneState.sortKey === k && (paneState.sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  )

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="relative file-row !h-7 border-b border-border !rounded-none mx-1" style={{ gridTemplateColumns: gridCols }}>
        <Header k="name">{t.pane.colName}</Header>
        <Header k="size" align="right">
          {t.pane.colSize}
        </Header>
        {cols.mtime && <Header k="mtime">{t.pane.colModified}</Header>}
        {cols.mode && <Header k="mode">{t.pane.colPermissions}</Header>}
        {cols.owner && <span className="text-[11.5px] uppercase tracking-wide text-dim truncate">{t.pane.colOwner}</span>}
        {paneState.loading && paneState.entries.length > 0 && <div className="loading-bar !top-auto -bottom-px" />}
      </div>

      <div
        id={listElementId(sid, pane)}
        ref={scrollRef}
        tabIndex={0}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1 outline-none"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={onKeyDown}
        onFocus={() => setActivePane(sid, pane)}
        onMouseDown={(e) => {
          setActivePane(sid, pane)
          if (e.target === e.currentTarget) setPane(sid, pane, { selected: [], anchor: undefined })
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            onContextMenu(e, null)
          }
        }}
      >
        {paneState.loading && !paneState.entries.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={22} />
          </div>
        )}
        {!paneState.loading && paneState.error && (
          <EmptyState icon={<FolderOpen size={32} />} title={t.pane.openFolderFailed} description={paneState.error} />
        )}
        {!paneState.loading && !paneState.error && total === 0 && (
          <EmptyState
            icon={<FolderOpen size={32} />}
            title={paneState.filter ? t.pane.noMatches : t.pane.folderEmpty}
            description={paneState.filter ? t.pane.filterNoMatches(paneState.filter) : !showHidden && paneState.entries.length ? t.pane.hiddenFilesOff : undefined}
          />
        )}
        <div style={{ height: startIdx * ROW }} />
        {slice.map((entry) => (
          <Row
            key={entry.path}
            entry={entry}
            gridCols={gridCols}
            cols={cols}
            selected={selectedSet.has(entry.path)}
            cursor={paneState.cursor === entry.path}
            renaming={paneState.renaming === entry.path}
            dropTarget={dropRow === entry.path}
            onSelect={select}
            onOpen={() => ops.openEntry(sid, pane, entry)}
            onContextMenu={(e) => {
              e.preventDefault()
              if (!selectedSet.has(entry.path)) select(entry, 'single')
              else setPane(sid, pane, { cursor: entry.path })
              onContextMenu(e, entry)
            }}
            onRenameDone={async (name) => {
              setPane(sid, pane, { renaming: undefined })
              if (name !== null) await ops.rename(sid, pane, entry, name)
              focusPane(sid, pane)
            }}
            onDragStart={(e) => onRowDragStart(e, entry)}
            onDragEnd={onRowDragEnd}
            onDragOver={(e) => onRowDragOver(e, entry)}
            onDragLeave={() => dropRow === entry.path && setDropRow(null)}
            onDrop={(e) => void onRowDrop(e, entry)}
          />
        ))}
        <div style={{ height: Math.max(0, (total - endIdx) * ROW) }} />
      </div>
    </div>
  )
}

interface Columns {
  owner: boolean
  mode: boolean
  mtime: boolean
}

function Row({
  entry,
  gridCols,
  cols,
  selected,
  cursor,
  renaming,
  dropTarget,
  onSelect,
  onOpen,
  onContextMenu,
  onRenameDone,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}: {
  entry: FileEntry
  gridCols: string
  cols: Columns
  selected: boolean
  cursor: boolean
  renaming: boolean
  dropTarget: boolean
  onSelect: (entry: FileEntry, mode: 'single' | 'toggle' | 'range') => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onRenameDone: (name: string | null) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  // Subscribe to the language so sizes and dates re-render when it changes
  useT()
  return (
    <div
      className={cn('file-row', selected && 'selected', cursor && 'cursor', dropTarget && 'drop-target')}
      style={{ gridTemplateColumns: gridCols }}
      draggable={!renaming}
      onMouseDown={(e) => {
        if (e.button === 2) return
        if (renaming) return
        if (e.ctrlKey || e.metaKey) onSelect(entry, 'toggle')
        else if (e.shiftKey) onSelect(entry, 'range')
        else if (!selected) onSelect(entry, 'single')
      }}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && selected && !renaming) onSelect(entry, 'single')
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        if (!renaming) onOpen()
      }}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={entry.linkTarget ? `${entry.name} → ${entry.linkTarget}` : entry.name}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileIcon entry={entry} />
        {renaming ? (
          <RenameInput initial={entry.name} isDir={entry.isDir} onDone={onRenameDone} />
        ) : (
          <>
            <span className="truncate text-[13px] shrink-0 max-w-full">{entry.name}</span>
            {entry.isSymlink && entry.linkTarget && (
              <span className="flex items-center gap-1 text-[11.5px] text-dim min-w-0 flex-1">
                <CornerDownRight size={11} className="shrink-0" />
                <span className="truncate font-mono">{entry.linkTarget}</span>
              </span>
            )}
          </>
        )}
      </div>
      <span className="text-right text-[12px] text-muted tabular-nums whitespace-nowrap">{entry.isDir ? '' : formatBytes(entry.size)}</span>
      {cols.mtime && <span className="text-[12px] text-muted tabular-nums truncate">{entry.isDrive ? '' : formatDate(entry.mtime)}</span>}
      {cols.mode && <span className="text-[11.5px] text-dim font-mono truncate">{entry.isDrive ? '' : modeToString(entry.mode)}</span>}
      {cols.owner && (
        <span className="text-[12px] text-dim truncate">
          {entry.owner ?? ''}
          {entry.group ? <span className="text-dim/70">:{entry.group}</span> : null}
        </span>
      )}
    </div>
  )
}

function RenameInput({ initial, isDir, onDone }: { initial: string; isDir: boolean; onDone: (name: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [v, setV] = useState(initial)
  const finished = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = initial.lastIndexOf('.')
    el.setSelectionRange(0, !isDir && dot > 0 ? dot : initial.length)
  }, [initial, isDir])
  const finish = (ok: boolean): void => {
    if (finished.current) return
    finished.current = true
    onDone(ok ? v : null)
  }
  return (
    <input
      ref={ref}
      className="input h-6 px-1.5 text-[13px] py-0"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      spellCheck={false}
    />
  )
}
