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
  X,
  ScrollText,
  FileSearch,
  ShieldAlert,
  Star,
  GitCompareArrows,
  ClipboardPaste,
  Scissors,
  Play,
  TextCursorInput
} from 'lucide-react'
import { useApp, paneTarget, type PaneId } from '@/store/app'
import { ops, selectedEntries, parseCustomCommands } from '@/lib/ops'
import { formatBytes } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import type { FileEntry } from '@shared/types'
import { IconButton, Spinner, Badge } from '../ui'
import { PathBar } from './PathBar'
import { FileList, focusPane, getCurrentDrag, useVisibleEntries } from './FileList'
import { ContextMenu, type MenuItem } from './ContextMenu'

export function FilePane({ sid, pane }: { sid: string; pane: PaneId }) {
  const t = useT()
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
  const navigate = useApp((s) => s.navigate)
  const visible = useVisibleEntries(sid, pane)
  const clipboard = useApp((s) => s.clipboard)
  const customCommandsText = useApp((s) => s.settings.customCommands)
  const bookmarks = useApp((s) => s.settings.bookmarks)
  const toggleSudo = useApp((s) => s.toggleSudo)
  const [editRequest, setEditRequest] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null)
  const [bookmarkMenu, setBookmarkMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const isRemote = pane === 'remote'
  const target = paneTarget(sid, pane)

  const selected = useMemo(() => (paneState ? selectedEntries({ ...paneState, entries: visible }) : []), [paneState, visible])
  const selectedSize = selected.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0)

  if (!paneState) return null

  const myBookmarks = ops.bookmarksFor(sid, pane)
  const isBookmarked = myBookmarks.some((b) => b.path === paneState.path)
  const customCommands = isRemote && session?.hasShell ? parseCustomCommands(customCommandsText).slice(0, 10) : []
  const canPaste = !!clipboard && clipboard.sid === sid

  const buildBookmarkMenu = (): MenuItem[] => {
    const items: MenuItem[] = myBookmarks.map((b) => ({
      label: b.label,
      icon: <Star size={14} />,
      shortcut: b.path.length > 42 ? '…' + b.path.slice(-40) : b.path,
      checked: b.path === paneState.path,
      onClick: () => void navigate(sid, pane, b.path)
    }))
    if (items.length) items.push({ type: 'separator' })
    items.push({
      label: isBookmarked ? t.pane.removeBookmark : t.pane.addBookmark,
      icon: <Star size={14} />,
      onClick: () => void ops.toggleBookmark(sid, pane)
    })
    return items
  }

  const buildMenu = (entry: FileEntry | null): MenuItem[] => {
    const cur = paneState
    const actOn = entry ? (selected.some((e) => e.path === entry.path) && selected.length > 1 ? selected : [entry]) : []
    const many = actOn.length > 1
    if (!entry) {
      return [
        { label: t.pane.newFolder, icon: <FolderPlus size={14} />, shortcut: 'F7', onClick: () => ops.mkdir(sid, pane) },
        { label: t.pane.newFile, icon: <FilePlus2 size={14} />, shortcut: 'Ctrl+Shift+N', onClick: () => ops.createFile(sid, pane) },
        { type: 'separator' },
        { label: t.pane.paste, icon: <ClipboardPaste size={14} />, shortcut: 'Ctrl+V', disabled: !canPaste, onClick: () => void ops.paste(sid, pane) },
        { label: t.common.refresh, icon: <RefreshCw size={14} />, shortcut: 'Ctrl+R', onClick: () => void refresh(sid, pane) },
        { label: t.pane.searchHere, icon: <FileSearch size={14} />, shortcut: 'Ctrl+Shift+F', onClick: () => ops.search(sid, pane) },
        ...(isRemote ? [{ label: t.pane.compareWithLocalMenu, icon: <GitCompareArrows size={14} />, onClick: () => ops.compare(sid) } as MenuItem] : []),
        { label: t.pane.showHidden, checked: showHidden, shortcut: 'Ctrl+H', onClick: () => void updateSettings({ showHidden: !showHidden }) },
        { type: 'separator' },
        ...(isRemote
          ? [{ label: t.pane.openTerminalHere, icon: <Terminal size={14} />, onClick: () => ops.openTerminalHere(sid, cur.path) } as MenuItem]
          : [{ label: t.pane.showInFileManager, icon: <SquareArrowOutUpRight size={14} />, onClick: () => void window.api.app.openPath(cur.path) } as MenuItem]),
        { label: t.pane.copyFolderPath, icon: <Copy size={14} />, onClick: () => void navigator.clipboard.writeText(cur.path) }
      ]
    }
    const items: MenuItem[] = []
    if (!many) {
      items.push({ label: entry.isDir ? t.common.open : t.pane.openInEditor, icon: <FilePen size={14} />, shortcut: 'Enter', onClick: () => ops.openEntry(sid, pane, entry) })
      if (!entry.isDir && isRemote) items.push({ label: t.pane.editExternal, icon: <SquareArrowOutUpRight size={14} />, shortcut: 'Shift+F4', onClick: () => ops.editExternal(sid, pane, entry) })
      if (!entry.isDir && !isRemote) items.push({ label: t.pane.openWithSystem, icon: <SquareArrowOutUpRight size={14} />, onClick: () => void window.api.app.openPath(entry.path) })
      if (!entry.isDir) items.push({ label: t.pane.followLog, icon: <ScrollText size={14} />, onClick: () => ops.tailLog(sid, pane, entry) })
      if (!isRemote && !entry.isDrive) items.push({ label: t.pane.showInFileManager, icon: <FolderInput size={14} />, onClick: () => ops.revealLocal(entry) })
      items.push({ type: 'separator' })
    }
    items.push({
      label: isRemote ? t.pane.downloadToComputer(actOn.length) : t.pane.uploadToServer(actOn.length),
      icon: isRemote ? <Download size={14} /> : <Upload size={14} />,
      shortcut: 'F5',
      disabled: actOn.some((e) => e.isDrive),
      onClick: () => ops.transfer(sid, pane, actOn)
    })
    items.push({
      label: isRemote ? t.pane.moveToComputer : t.pane.moveToServer,
      icon: <FolderInput size={14} />,
      shortcut: 'F6',
      disabled: actOn.some((e) => e.isDrive),
      onClick: () => ops.moveToOtherPane(sid, pane, actOn)
    })
    items.push({ label: t.pane.moveToFolder, icon: <FolderInput size={14} />, shortcut: 'Shift+F6', disabled: actOn.some((e) => e.isDrive), onClick: () => ops.moveTo(sid, pane, actOn) })
    items.push({ type: 'separator' })
    items.push({ label: t.common.copy, icon: <Copy size={14} />, shortcut: 'Ctrl+C', disabled: actOn.some((e) => e.isDrive), onClick: () => ops.copyToClipboard(sid, pane, actOn, false) })
    items.push({ label: t.pane.cut, icon: <Scissors size={14} />, shortcut: 'Ctrl+X', disabled: actOn.some((e) => e.isDrive), onClick: () => ops.copyToClipboard(sid, pane, actOn, true) })
    items.push({ label: t.pane.paste, icon: <ClipboardPaste size={14} />, shortcut: 'Ctrl+V', disabled: !canPaste, onClick: () => void ops.paste(sid, pane) })
    items.push({ type: 'separator' })
    if (!many) items.push({ label: t.common.rename, icon: <Pencil size={14} />, shortcut: 'F2', disabled: entry.isDrive, onClick: () => setPane(sid, pane, { renaming: entry.path }) })
    if (many) items.push({ label: t.pane.batchRename, icon: <TextCursorInput size={14} />, disabled: actOn.some((e) => e.isDrive), onClick: () => ops.massRename(sid, pane, actOn) })
    items.push({ label: t.common.delete, icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, disabled: actOn.some((e) => e.isDrive), onClick: () => ops.deleteEntries(sid, pane, actOn) })
    items.push({ type: 'separator' })
    items.push({ label: t.pane.permissionsMenu, icon: <ShieldCheck size={14} />, disabled: actOn.some((e) => e.isDrive), onClick: () => ops.chmod(sid, pane, actOn) })
    items.push({ label: t.pane.copyPath, icon: <Copy size={14} />, shortcut: 'Ctrl+Shift+C', onClick: () => ops.copyPath(actOn) })
    if (isRemote && entry.isDir && !many) items.push({ label: t.pane.openTerminalHere, icon: <Terminal size={14} />, onClick: () => ops.openTerminalHere(sid, entry.path) })
    if (!many) items.push({ label: t.pane.properties, icon: <Info size={14} />, onClick: () => ops.properties(sid, pane, entry) })
    if (customCommands.length) {
      items.push({ type: 'separator' })
      for (const c of customCommands) items.push({ label: c.name, icon: <Play size={14} />, onClick: () => ops.runCustomCommand(sid, pane, actOn, c) })
    }
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
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
          e.preventDefault()
          ops.search(sid, pane)
          return
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault()
          setPane(sid, pane, { filterOpen: true })
          setTimeout(() => document.getElementById(`filter-${sid}-${pane}`)?.focus(), 0)
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 h-10 border-b border-border">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium shrink-0',
            isRemote ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-muted'
          )}
          title={isRemote ? `${session?.username}@${session?.host}` : t.pane.localComputer}
        >
          {isRemote ? <Server size={13} /> : <Laptop size={13} />}
          {isRemote ? session?.host ?? t.common.server : t.common.local}
        </span>
        {isRemote && session?.sudo && (
          <span title={session.sudoFiles ? t.pane.sudoFilesTitle : t.pane.sudoCommandsTitle}>
            <Badge tone={session.sudoFiles ? 'danger' : 'warning'}>{session.sudoFiles ? 'root' : t.pane.sudoCommandsBadge}</Badge>
          </span>
        )}
        <IconButton title={t.pane.back} onClick={() => goBack(sid, pane)} disabled={paneState.historyIndex <= 0}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton title={t.pane.forward} onClick={() => goForward(sid, pane)} disabled={paneState.historyIndex >= paneState.history.length - 1}>
          <ChevronRight size={16} />
        </IconButton>
        <IconButton title={t.pane.up} onClick={() => goUp(sid, pane)}>
          <ArrowUp size={16} />
        </IconButton>
        <IconButton title={t.pane.homeFolder} onClick={() => void goHome(sid, pane)}>
          <House size={15} />
        </IconButton>
        <PathBar sid={sid} pane={pane} editRequest={editRequest} />
        <IconButton title={t.pane.bookmarks} active={isBookmarked} onClick={(e) => setBookmarkMenu({ x: e.clientX, y: e.clientY })}>
          <Star size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton title={t.pane.refreshHint} onClick={() => void refresh(sid, pane)}>
          {paneState.loading ? <Spinner size={14} /> : <RefreshCw size={15} />}
        </IconButton>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border">
        <IconButton title={t.pane.newFolderHint} onClick={() => ops.mkdir(sid, pane)}>
          <FolderPlus size={15} />
        </IconButton>
        <IconButton title={t.pane.newFileHint} onClick={() => ops.createFile(sid, pane)}>
          <FilePlus2 size={15} />
        </IconButton>
        <span className="w-px h-5 bg-border mx-1" />
        <IconButton
          title={isRemote ? t.pane.downloadSelectedHint : t.pane.uploadSelectedHint}
          disabled={!selected.length}
          onClick={() => ops.transfer(sid, pane, selected)}
        >
          {isRemote ? <Download size={15} /> : <Upload size={15} />}
        </IconButton>
        <IconButton title={t.pane.renameHint} disabled={selected.length !== 1} onClick={() => setPane(sid, pane, { renaming: selected[0].path })}>
          <Pencil size={15} />
        </IconButton>
        <IconButton title={t.pane.deleteHint} disabled={!selected.length} danger onClick={() => ops.deleteEntries(sid, pane, selected)}>
          <Trash2 size={15} />
        </IconButton>
        <IconButton title={t.pane.permissions} disabled={!selected.length} onClick={() => ops.chmod(sid, pane, selected)}>
          <ShieldCheck size={15} />
        </IconButton>
        <span className="flex-1" />
        {isRemote && (
          <>
            <IconButton
              title={session?.sudo ? t.pane.sudoOff : t.pane.sudoOn}
              active={!!session?.sudo}
              danger={!!session?.sudo}
              disabled={!session?.hasShell || session?.status !== 'connected'}
              onClick={() => void toggleSudo(sid)}
            >
              <ShieldAlert size={15} />
            </IconButton>
            <IconButton title={t.pane.compareWithLocal} onClick={() => ops.compare(sid)}>
              <GitCompareArrows size={15} />
            </IconButton>
            <IconButton title={t.pane.terminalHere} onClick={() => ops.openTerminalHere(sid, paneState.path)}>
              <Terminal size={15} />
            </IconButton>
          </>
        )}
        <IconButton title={t.pane.searchHint} onClick={() => ops.search(sid, pane)}>
          <FileSearch size={15} />
        </IconButton>
        <IconButton title={showHidden ? t.pane.hideHiddenHint : t.pane.showHiddenHint} active={showHidden} onClick={() => void updateSettings({ showHidden: !showHidden })}>
          {showHidden ? <Eye size={15} /> : <EyeOff size={15} />}
        </IconButton>
        <IconButton
          title={t.pane.filterHint}
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
            placeholder={t.pane.filterPlaceholder}
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
          <IconButton title={t.pane.closeFilter} size={24} onClick={() => setPane(sid, pane, { filter: '', filterOpen: false })}>
            <X size={14} />
          </IconButton>
        </div>
      )}

      <FileList
        sid={sid}
        pane={pane}
        onContextMenu={(e, entry) => setMenu({ x: e.clientX, y: e.clientY, entry })}
      />

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 h-7 border-t border-border text-[11.5px] text-dim">
        <span>
          {paneState.entries.length !== visible.length ? t.pane.itemsOf(visible.length, paneState.entries.length) : t.common.items(visible.length)}
        </span>
        {selected.length > 0 && (
          <span className="text-muted">
            {t.pane.selectedCount(selected.length)}
            {selectedSize > 0 && ` · ${formatBytes(selectedSize)}`}
          </span>
        )}
        <span className="flex-1" />
        {paneState.disk && (
          <span title={t.pane.diskFreeOf(formatBytes(paneState.disk.free), formatBytes(paneState.disk.total))}>
            {t.pane.diskFree(formatBytes(paneState.disk.free))}
          </span>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={buildMenu(menu.entry)} onClose={() => setMenu(null)} />}
      {bookmarkMenu && <ContextMenu x={bookmarkMenu.x} y={bookmarkMenu.y} items={buildBookmarkMenu()} onClose={() => setBookmarkMenu(null)} />}
    </section>
  )
}

