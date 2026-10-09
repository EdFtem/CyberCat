import { useCallback, useEffect, useRef, useState } from 'react'
import { Code2, Container, Plug, RotateCcw, Terminal as TerminalIcon, TriangleAlert, Unplug, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { selectedEntries } from '@/lib/ops'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Button, Spinner, StatusDot, Badge } from '../ui'
import { FilePane } from '../pane/FilePane'
import { EditorView } from '../editor/EditorView'
import { TerminalPanel } from '../terminal/TerminalPanel'
import { DockerView } from '../docker/DockerView'
import { TransfersPanel } from '../transfers/TransfersPanel'

const SPLIT_KEY = 'cc.split'
const TERM_KEY = 'cc.termHeight'

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function SessionView({ sid, visible }: { sid: string; visible: boolean }) {
  const t = useT()
  const session = useApp((s) => s.sessions[sid])
  const ui = useApp((s) => s.ui[sid])
  const reconnect = useApp((s) => s.reconnect)
  const closeTab = useApp((s) => s.closeTab)
  const toggleTerminal = useApp((s) => s.toggleTerminal)
  const setEditorVisible = useApp((s) => s.setEditorVisible)
  const setDockerOpen = useApp((s) => s.setDockerOpen)
  const transfersOpen = useApp((s) => s.transfersOpen)
  const [split, setSplit] = useState(() => readNumber(SPLIT_KEY, 0.5))
  const [termHeight, setTermHeight] = useState(() => readNumber(TERM_KEY, 260))
  const [dragging, setDragging] = useState<'split' | 'term' | null>(null)
  const panesRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        toggleTerminal(sid)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && ui?.docs.length) {
        e.preventDefault()
        setEditorVisible(sid, !ui.editorVisible)
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd' && ui) {
        e.preventDefault()
        setDockerOpen(sid, !ui.dockerOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, sid, ui?.docs.length, ui?.editorVisible, ui?.dockerOpen, ui, toggleTerminal, setEditorVisible, setDockerOpen])

  const onSplitMove = useCallback(
    (e: MouseEvent) => {
      const el = panesRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const ratio = Math.min(0.8, Math.max(0.2, (e.clientX - r.left) / r.width))
      setSplit(ratio)
    },
    []
  )
  const onTermMove = useCallback((e: MouseEvent) => {
    const el = bodyRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = Math.min(r.height - 160, Math.max(120, r.bottom - e.clientY))
    setTermHeight(h)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = dragging === 'split' ? onSplitMove : onTermMove
    const up = (): void => {
      setDragging(null)
      try {
        localStorage.setItem(SPLIT_KEY, String(split))
        localStorage.setItem(TERM_KEY, String(termHeight))
      } catch {
        /* ignore */
      }
    }
    document.body.style.cursor = dragging === 'split' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, onSplitMove, onTermMove, split, termHeight])

  if (!session || !ui) return null
  const connected = session.status === 'connected'
  const hasPanes = ui.initialized

  if (!hasPanes) {
    return (
      <div className={cn('h-full flex items-center justify-center', !visible && 'hidden')}>
        <div className="card p-8 w-[440px] text-center" style={{ boxShadow: 'var(--shadow)' }}>
          {session.status === 'error' || session.status === 'disconnected' ? (
            <>
              <TriangleAlert size={36} className="mx-auto text-danger" />
              <h2 className="text-[16px] font-semibold mt-3">{t.session.connectFailed}</h2>
              <p className="text-[13px] text-muted mt-2 whitespace-pre-wrap">{session.error ?? t.common.unknownError}</p>
              <p className="text-[12px] text-dim mt-2 font-mono">
                {session.username}@{session.host}:{session.port}
              </p>
              <div className="flex justify-center gap-2 mt-5">
                <Button variant="primary" icon={<RotateCcw size={14} />} onClick={() => void reconnect(sid)}>
                  {t.common.retry}
                </Button>
                <Button icon={<X size={14} />} onClick={() => void closeTab(sid)}>
                  {t.common.close}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Spinner size={30} className="mx-auto" />
              <h2 className="text-[16px] font-semibold mt-3">{t.session.connecting}</h2>
              <p className="text-[12.5px] text-dim mt-2 font-mono">
                {session.username}@{session.host}:{session.port}
              </p>
              <Button className="mt-5" onClick={() => void closeTab(sid)}>
                {t.common.cancel}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const activePane = ui.panes[ui.activePane]
  const sel = selectedEntries(activePane)
  const selSize = sel.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0)

  return (
    <div className={cn('flex flex-col h-full min-h-0', !visible && 'hidden')}>
      {!connected && (
        <div className="flex items-center gap-3 px-4 h-9 bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[12.5px] border-b border-border">
          {session.status === 'reconnecting' || session.status === 'connecting' ? <Spinner size={14} /> : <Unplug size={14} className="text-warning" />}
          <span className="text-warning font-medium">{session.status === 'reconnecting' || session.status === 'connecting' ? t.session.reconnecting : t.session.connectionLost}</span>
          <span className="text-muted truncate">{session.error}</span>
          <span className="flex-1" />
          {session.status !== 'reconnecting' && session.status !== 'connecting' && (
            <Button size="sm" variant="primary" icon={<Plug size={13} />} onClick={() => void reconnect(sid)}>
              {t.session.reconnect}
            </Button>
          )}
        </div>
      )}

      <div ref={bodyRef} className="flex flex-col flex-1 min-h-0 p-2 gap-0">
        <div ref={panesRef} className={cn('flex flex-1 min-h-0', (ui.editorVisible || ui.dockerOpen) && 'hidden')}>
          <div style={{ flex: `0 0 calc(${split * 100}% - 3px)` }} className="flex min-w-0">
            <FilePane sid={sid} pane="local" />
          </div>
          <div className={cn('splitter', dragging === 'split' && 'active')} onMouseDown={() => setDragging('split')} onDoubleClick={() => setSplit(0.5)} />
          <div className="flex flex-1 min-w-0">
            <FilePane sid={sid} pane="remote" />
          </div>
        </div>
        {ui.editorVisible && (
          <div className="flex flex-1 min-h-0">
            <EditorView sid={sid} />
          </div>
        )}
        {!ui.editorVisible && ui.dockerOpen && (
          <div className="flex flex-1 min-h-0">
            <DockerView sid={sid} />
          </div>
        )}

        {ui.terminalOpen && (
          <>
            <div className={cn('splitter-h my-0.5', dragging === 'term' && 'active')} onMouseDown={() => setDragging('term')} />
            <div style={{ height: termHeight }} className="shrink-0 min-h-0">
              <TerminalPanel sid={sid} />
            </div>
          </>
        )}

        {transfersOpen && visible && (
          <div className="mt-2">
            <TransfersPanel />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 h-7 border-t border-border bg-surface text-[11.5px] text-dim shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={session.status} />
          <span className="text-muted font-mono">
            {session.username}@{session.host}
            {session.port !== 22 && `:${session.port}`}
          </span>
        </span>
        {connected && <Badge tone={session.hasShell ? 'success' : 'warning'}>{session.hasShell ? 'SFTP + shell' : t.session.sftpOnly}</Badge>}
        {sel.length > 0 && (
          <span>{t.session.selection(ui.activePane, sel.length, selSize > 0 ? formatBytes(selSize) : undefined)}</span>
        )}
        <span className="flex-1" />
        {ui.docs.length > 0 && (
          <StatusButton title={t.session.editorTitle} active={ui.editorVisible} onClick={() => setEditorVisible(sid, !ui.editorVisible)}>
            <Code2 size={13} /> {t.session.editorFiles(ui.docs.length)}
          </StatusButton>
        )}
        <StatusButton title="Docker (Ctrl+Shift+D)" active={ui.dockerOpen} onClick={() => setDockerOpen(sid, !ui.dockerOpen)} disabled={!connected || !session.hasShell}>
          <Container size={13} /> Docker
        </StatusButton>
        <StatusButton title={t.session.terminalTitle} active={ui.terminalOpen} onClick={() => toggleTerminal(sid)} disabled={!connected}>
          <TerminalIcon size={13} /> {t.terminal.title}
        </StatusButton>
      </div>
    </div>
  )
}

/** Status bar toggle with an icon and a label */
function StatusButton({
  active,
  disabled,
  title,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-5 px-1.5 rounded text-[11.5px] transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-3'
      )}
    >
      {children}
    </button>
  )
}
