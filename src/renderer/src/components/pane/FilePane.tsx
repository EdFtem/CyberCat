import { useMemo, useState } from 'react'
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePen,
  FilePlus2,
  FolderInput,
  FolderPlus,
  House,
  Info,
  Laptop,
  Pencil,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SquareArrowOutUpRight,
  Terminal,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { useApp, paneTarget, type PaneId } from '@/store/app'
import { ops, selectedEntries } from '@/lib/ops'
import { countLabel, formatBytes } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { FileEntry } from '@shared/types'
import { IconButton, Spinner } from '../ui'
import { PathBar } from './PathBar'
import { FileList, focusPane, getCurrentDrag, useVisibleEntries } from './FileList'
import { ContextMenu, type MenuItem } from './ContextMenu'

export function FilePane({ sid, pane }: { sid: string; pane: PaneId }) {
  const paneState = useApp((s) => s.ui[sid]?.panes[pane])
  const active = useApp((s) => s.ui[sid]?.activePane === pane)
  const session = useApp((s) => s.sessions[sid])
  const showHidden = useApp((s) => s.settings.showHidden)
  const updateSettings = useApp((s) => s.updateSettings)
  const setPane = useApp((s) => s.setPane)
  const goBack = useApp((s) => s.goBack)
  const goForward = useApp((s) => s.goForward)
  const goUp = useApp((s) => s.goUp)
  const goHome = useApp((s) => s.goHome)
  const refresh = useApp((s) => s.refresh)
  const visible = useVisibleEntries(sid, pane)
  const [editRequest, setEditRequest] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const isRemote = pane === 'remote'
  const target = paneTarget(sid, pane)

  const selected = useMemo(() => (paneState ? selectedEntries({ ...paneState, entries: visible }) : []), [paneState, visible])
  const selectedSize = selected.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0)

  if (!paneState) return null

  const buildMenu = (entry: FileEntry | null): MenuItem[] => {
    const cur = paneState
    const actOn = entry ? (selected.some((e) => e.path === entry.path) && selected.length > 1 ? selected : [entry]) : []
    const many = actOn.length > 1
    if (!entry) {
      return [
        { label: 'Нова тека', icon: <FolderPlus size={14} />, shortcut: 'F7', onClick: () => ops.mkdir(sid, pane) },
        { label: 'Новий файл', icon: <FilePlus2 size={14} />, shortcut: 'Ctrl+Shift+N', onClick: () => ops.createFile(sid, pane) },
        { type: 'separator' },
        { label: 'Оновити', icon: <RefreshCw size={14} />, shortcut: 'Ctrl+R', onClick: () => void refresh(sid, pane) },
        { label: 'Показувати приховані', checked: showHidden, shortcut: 'Ctrl+H', onClick: () => void updateSettings({ showHidden: !showHidden }) },
        { type: 'separator' },
        ...(isRemote
          ? [{ label: 'Відкрити термінал тут', icon: <Terminal size={14} />, onClick: () => ops.openTerminalHere(sid, cur.path) } as MenuItem]
          : [{ label: 'Показати у Провіднику', icon: <SquareArrowOutUpRight size={14} />, onClick: () => void window.api.app.openPath(cur.path) } as MenuItem]),
        { label: 'Копіювати шлях теки', icon: <Copy size={14} />, onClick: () => void navigator.clipboard.writeText(cur.path) }
      ]
    }
    const items: MenuItem[] = []
    if (!many) {
      items.push({ label: entry.isDir ? 'Відкрити' : 'Відкрити у редакторі', icon: <FilePen size={14} />, shortcut: 'Enter', onClick: () => ops.openEntry(sid, pane, entry) })
      if (!entry.isDir && isRemote) items.push({ label: 'Редагувати у зовнішньому редакторі', icon: <SquareArrowOutUpRight size={14} />, shortcut: 'Shift+F4', onClick: () => ops.editExternal(sid, pane, entry) })
      if (!entry.isDir && !isRemote) items.push({ label: 'Відкрити системною програмою', icon: <SquareArrowOutUpRight size={14} />, onClick: () => void window.api.app.openPath(entry.path) })
      if (!isRemote && !entry.isDrive) items.push({ label: 'Показати у Провіднику', icon: <FolderInput size={14} />, onClick: () => ops.revealLocal(entry) })
      items.push({ type: 'separator' })
    }
    items.push({
      label: isRemote ? `Завантажити ${many ? countLabel(actOn.length, 'елемент', 'елементи', 'елементів') : ''} на комп’ютер` : `Відвантажити ${many ? countLabel(actOn.length, 'елемент', 'елементи', 'елементів') : ''} на сервер`,
      icon: isRemote ? <Download size={14} /> : <Upload size={14} />,
      shortcut: 'F5',
      disabled: actOn.some((e) => e.isDrive),
      onClick: () => ops.transfer(sid, pane, actOn)
    })
    items.push({ label: 'Перемістити…', icon: <FolderInput size={14} />, shortcut: 'F6', disabled: actOn.some((e) => e.isDrive), onClick: () => ops.moveTo(sid, pane, actOn) })
    if (!many) items.push({ label: 'Перейменувати', icon: <Pencil size={14} />, shortcut: 'F2', disabled: entry.isDrive, onClick: () => setPane(sid, pane, { renaming: entry.path }) })
    items.push({ label: 'Видалити', icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, disabled: actOn.some((e) => e.isDrive), onClick: () => ops.deleteEntries(sid, pane, actOn) })
    items.push({ type: 'separator' })
    items.push({ label: 'Права доступу…', icon: <ShieldCheck size={14} />, disabled: actOn.some((e) => e.isDrive), onClick: () => ops.chmod(sid, pane, actOn) })
    items.push({ label: 'Копіювати шлях', icon: <Copy size={14} />, shortcut: 'Ctrl+Shift+C', onClick: () => ops.copyPath(actOn) })
    if (isRemote && entry.isDir && !many) items.push({ label: 'Відкрити термінал тут', icon: <Terminal size={14} />, onClick: () => ops.openTerminalHere(sid, entry.path) })
    if (!many) items.push({ label: 'Властивості', icon: <Info size={14} />, onClick: () => ops.properties(sid, pane, entry) })
    return items
  }

  const canDrop = (e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer.types)
    const d = getCurrentDrag()
    if (types.includes('application/x-cybercat')) return !!d && !(d.sid === sid && d.pane === pane)
    if (types.includes('Files')) return isRemote
    return false
  }

  return (
    <section
      className={cn('flex flex-col min-w-0 flex-1 bg-surface rounded-lg border transition-colors', active ? 'border-border-strong' : 'border-border', dragOver && 'pane-drop')}
      onDragOver={(e) => {
        if (!canDrop(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={(e) => {
        setDragOver(false)
        if (!canDrop(e)) return
        e.preventDefault()
        const d = getCurrentDrag()
        if (d) {
          ops.transfer(sid, d.pane, d.entries, paneState.path)
          return
        }
        if (e.dataTransfer.files.length && isRemote && paneState.path) {
          void ops.uploadOsFiles(sid, Array.from(e.dataTransfer.files), paneState.path)
        }
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
          e.preventDefault()
          setEditRequest((n) => n + 1)
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault()
          setPane(sid, pane, { filterOpen: true })
          setTimeout(() => document.getElementById(`filter-${sid}-${pane}`)?.focus(), 0)
        }
      }}
    >
      {/* Заголовок */}
      <div className="flex items-center gap-1.5 px-2 h-10 border-b border-border">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium shrink-0',
            isRemote ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-muted'
          )}
          title={isRemote ? `${session?.username}@${session?.host}` : 'Локальний комп’ютер'}
        >
          {isRemote ? <Server size={13} /> : <Laptop size={13} />}
          {isRemote ? session?.host ?? 'Сервер' : 'Локально'}
        </span>
        <IconButton title="Назад" onClick={() => goBack(sid, pane)} disabled={paneState.historyIndex <= 0}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton title="Вперед" onClick={() => goForward(sid, pane)} disabled={paneState.historyIndex >= paneState.history.length - 1}>
          <ChevronRight size={16} />
        </IconButton>
        <IconButton title="Вгору (Backspace)" onClick={() => goUp(sid, pane)}>
          <ArrowUp size={16} />
        </IconButton>
        <IconButton title="Домашня тека" onClick={() => void goHome(sid, pane)}>
          <House size={15} />
        </IconButton>
        <PathBar sid={sid} pane={pane} editRequest={editRequest} />
        <IconButton title="Оновити (Ctrl+R)" onClick={() => void refresh(sid, pane)}>
          {paneState.loading ? <Spinner size={14} /> : <RefreshCw size={15} />}
        </IconButton>
      </div>

      {/* Панель дій */}
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border">
        <IconButton title="Нова тека (F7)" onClick={() => ops.mkdir(sid, pane)}>
          <FolderPlus size={15} />
        </IconButton>
        <IconButton title="Новий файл (Ctrl+Shift+N)" onClick={() => ops.createFile(sid, pane)}>
          <FilePlus2 size={15} />
        </IconButton>
        <span className="w-px h-5 bg-border mx-1" />
        <IconButton
          title={isRemote ? 'Завантажити вибране на комп’ютер (F5)' : 'Відвантажити вибране на сервер (F5)'}
          disabled={!selected.length}
          onClick={() => ops.transfer(sid, pane, selected)}
        >
          {isRemote ? <Download size={15} /> : <Upload size={15} />}
        </IconButton>
        <IconButton title="Перейменувати (F2)" disabled={selected.length !== 1} onClick={() => setPane(sid, pane, { renaming: selected[0].path })}>
          <Pencil size={15} />
        </IconButton>
        <IconButton title="Видалити (Del)" disabled={!selected.length} danger onClick={() => ops.deleteEntries(sid, pane, selected)}>
          <Trash2 size={15} />
        </IconButton>
        <IconButton title="Права доступу" disabled={!selected.length} onClick={() => ops.chmod(sid, pane, selected)}>
          <ShieldCheck size={15} />
        </IconButton>
        <span className="flex-1" />
        {isRemote && (
          <IconButton title="Термінал у цій теці" onClick={() => ops.openTerminalHere(sid, paneState.path)}>
            <Terminal size={15} />
          </IconButton>
        )}
        <IconButton title={showHidden ? 'Сховати приховані (Ctrl+H)' : 'Показати приховані (Ctrl+H)'} active={showHidden} onClick={() => void updateSettings({ showHidden: !showHidden })}>
          {showHidden ? <Eye size={15} /> : <EyeOff size={15} />}
        </IconButton>
        <IconButton
          title="Фільтр (Ctrl+F)"
          active={paneState.filterOpen || !!paneState.filter}
          onClick={() => {
            setPane(sid, pane, { filterOpen: !paneState.filterOpen, filter: paneState.filterOpen ? '' : paneState.filter })
            setTimeout(() => document.getElementById(`filter-${sid}-${pane}`)?.focus(), 0)
          }}
        >
          <Search size={15} />
        </IconButton>
      </div>

      {paneState.filterOpen && (
        <div className="flex items-center gap-2 px-2 h-9 border-b border-border bg-surface-2">
          <Search size={14} className="text-dim" />
          <input
            id={`filter-${sid}-${pane}`}
            className="input h-7 flex-1"
            placeholder="Фільтр за назвою…"
            value={paneState.filter}
            onChange={(e) => setPane(sid, pane, { filter: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setPane(sid, pane, { filter: '', filterOpen: false })
                focusPane(sid, pane)
              }
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                focusPane(sid, pane)
              }
            }}
          />
          <IconButton title="Закрити фільтр" size={24} onClick={() => setPane(sid, pane, { filter: '', filterOpen: false })}>
            <X size={14} />
          </IconButton>
        </div>
      )}

      <FileList
        sid={sid}
        pane={pane}
        onContextMenu={(e, entry) => setMenu({ x: e.clientX, y: e.clientY, entry })}
      />

      {/* Підвал */}
      <div className="flex items-center gap-3 px-3 h-7 border-t border-border text-[11.5px] text-dim">
        <span>
          {countLabel(visible.length, 'елемент', 'елементи', 'елементів')}
          {paneState.entries.length !== visible.length && ` з ${paneState.entries.length}`}
        </span>
        {selected.length > 0 && (
          <span className="text-muted">
            Вибрано {selected.length}
            {selectedSize > 0 && ` · ${formatBytes(selectedSize)}`}
          </span>
        )}
        <span className="flex-1" />
        {paneState.disk && (
          <span title={`Вільно ${formatBytes(paneState.disk.free)} з ${formatBytes(paneState.disk.total)}`}>
            Вільно {formatBytes(paneState.disk.free)}
          </span>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={buildMenu(menu.entry)} onClose={() => setMenu(null)} />}
    </section>
  )
}

