import { useState } from 'react'
import { ArrowDownUp, Cat, House, Moon, PencilLine, Plus, Settings, Sun, Upload, X, CircleAlert, Eye, Globe, ExternalLink } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/cn'
import { IconButton, StatusDot, Spinner } from './ui'
import { formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'

export function TitleBar() {
  const t = useT()
  const tabs = useApp((s) => s.tabs)
  const sessions = useApp((s) => s.sessions)
  const activeTab = useApp((s) => s.activeTab)
  const setActiveTab = useApp((s) => s.setActiveTab)
  const closeTab = useApp((s) => s.closeTab)
  const transfers = useApp((s) => s.transfers)
  const transfersOpen = useApp((s) => s.transfersOpen)
  const setTransfersOpen = useApp((s) => s.setTransfersOpen)
  const extedits = useApp((s) => s.extedits)
  const theme = useApp((s) => s.settings.theme)
  const updateSettings = useApp((s) => s.updateSettings)
  const openDialog = useApp((s) => s.openDialog)
  const platform = useApp((s) => s.info?.platform)
  const [editsOpen, setEditsOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const watches = useApp((s) => s.watches)
  const [tunnelOpen, setTunnelOpen] = useState(false)
  const tunnels = useApp((s) => s.tunnels)

  const padRight = platform === 'win32' ? 150 : 12
  const padLeft = platform === 'darwin' ? 80 : 12

  return (
    <header
      className="drag-region relative flex items-center h-10 shrink-0 border-b border-border bg-bg"
      style={{ paddingLeft: padLeft, paddingRight: padRight }}
    >
      <div className="flex items-center gap-2 pr-3 mr-1 select-none">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-accent text-accent-fg">
          <Cat size={15} strokeWidth={2.2} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight">CyberCat</span>
      </div>

      <nav className="flex items-end gap-1 flex-1 min-w-0 h-full overflow-x-auto no-drag" style={{ scrollbarWidth: 'none' }}>
        <Tab active={activeTab === 'home'} onClick={() => setActiveTab('home')} title={t.titleBar.connections}>
          <House size={14} />
          <span>{t.titleBar.connections}</span>
        </Tab>
        {tabs.map((id) => {
          const s = sessions[id]
          if (!s) return null
          return (
            <Tab key={id} active={activeTab === id} onClick={() => setActiveTab(id)} title={`${s.username}@${s.host}:${s.port}`} color={s.color}>
              {s.status === 'connecting' || s.status === 'reconnecting' ? <Spinner size={12} /> : <StatusDot status={s.status} />}
              <span className="truncate max-w-[180px]">{s.name}</span>
              <button
                type="button"
                className="ml-1 -mr-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-surface-4 text-dim hover:text-text"
                onClick={(e) => {
                  e.stopPropagation()
                  void closeTab(id)
                }}
                title={t.titleBar.closeSession}
              >
                <X size={12} />
              </button>
            </Tab>
          )
        })}
        <IconButton title={t.titleBar.newConnection} onClick={() => setActiveTab('home')} size={26} className="mb-[7px] ml-1">
          <Plus size={15} />
        </IconButton>
      </nav>

      <div className="flex items-center gap-1 pl-2 no-drag">
        <div className="relative">
          <IconButton
            title={t.titleBar.externalEdits}
            active={editsOpen}
            onClick={() => setEditsOpen((v) => !v)}
            disabled={!extedits.length}
          >
            <PencilLine size={16} />
            {extedits.length > 0 && <Dot count={extedits.length} tone={extedits.some((e) => e.status === 'error') ? 'danger' : 'accent'} />}
          </IconButton>
          {editsOpen && <ExternalEditsMenu onClose={() => setEditsOpen(false)} />}
        </div>
        {tunnels.length > 0 && (
          <div className="relative">
            <IconButton title={t.titleBar.tunnels} active={tunnelOpen} onClick={() => setTunnelOpen((v) => !v)}>
              <Globe size={16} />
              <Dot count={tunnels.length} tone="accent" />
            </IconButton>
            {tunnelOpen && <TunnelMenu onClose={() => setTunnelOpen(false)} />}
          </div>
        )}
        {watches.length > 0 && (
          <div className="relative">
            <IconButton title={t.titleBar.watches} active={watchOpen} onClick={() => setWatchOpen((v) => !v)}>
              <Eye size={16} />
              <Dot count={watches.length} tone={watches.some((w) => w.status === 'error') ? 'danger' : 'accent'} />
            </IconButton>
            {watchOpen && <WatchMenu onClose={() => setWatchOpen(false)} />}
          </div>
        )}
        <IconButton title={t.titleBar.transfers} active={transfersOpen} onClick={() => setTransfersOpen(!transfersOpen)}>
          <ArrowDownUp size={16} />
          {transfers.active > 0 && <Dot count={transfers.active} tone="accent" />}
        </IconButton>
        <IconButton title={theme === 'dark' ? t.titleBar.lightTheme : t.titleBar.darkTheme} onClick={() => void updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton title={t.titleBar.settings} onClick={() => openDialog({ kind: 'settings' })}>
          <Settings size={16} />
        </IconButton>
      </div>
    </header>
  )
}

function Dot({ count, tone }: { count: number; tone: 'accent' | 'danger' }) {
  return (
    <span
      className={cn(
        'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold leading-4 text-center',
        tone === 'accent' ? 'bg-accent text-accent-fg' : 'bg-danger text-white'
      )}
    >
      {count}
    </span>
  )
}

function Tab({
  active,
  onClick,
  children,
  title,
  color
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'relative inline-flex items-center gap-2 h-[33px] px-3 rounded-t-lg text-[12.5px] whitespace-nowrap transition-colors border border-b-0',
        active ? 'bg-surface text-text border-border' : 'bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-text'
      )}
    >
      {color && <span className="absolute left-0 right-0 top-0 h-[2px] rounded-t-lg" style={{ background: color }} />}
      {children}
    </button>
  )
}

function TunnelMenu({ onClose }: { onClose: () => void }) {
  const t = useT()
  const tunnels = useApp((s) => s.tunnels)
  const sessions = useApp((s) => s.sessions)
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div className="absolute right-0 top-9 z-50 w-[380px] card p-2" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-dim">{t.titleBar.tunnelsHeading}</div>
        {tunnels.map((tun) => (
          <div key={tun.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-mono truncate">
                localhost:{tun.localPort} → {tun.remoteHost}:{tun.remotePort}
              </div>
              <div className="text-[11.5px] text-dim truncate">
                {sessions[tun.sessionId]?.name ?? t.common.session} · {t.titleBar.tunnelConnections(tun.connections)}
              </div>
            </div>
            <IconButton title={t.titleBar.openInBrowser} size={26} onClick={() => void window.api.app.openExternal(`http://localhost:${tun.localPort}`)}>
              <ExternalLink size={14} />
            </IconButton>
            <IconButton title={t.titleBar.closeTunnel} size={26} danger onClick={() => void window.api.tunnel.stop(tun.id)}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </>
  )
}

function WatchMenu({ onClose }: { onClose: () => void }) {
  const t = useT()
  const watches = useApp((s) => s.watches)
  const sessions = useApp((s) => s.sessions)
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div className="absolute right-0 top-9 z-50 w-[400px] card p-2" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-dim">{t.titleBar.watchesHeading}</div>
        {watches.map((w) => (
          <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-mono truncate" title={w.localDir}>
                {w.localDir}
              </div>
              <div className="text-[11.5px] text-dim truncate" title={w.remoteDir}>
                → {sessions[w.sessionId]?.name ?? t.common.session}: {w.remoteDir}
              </div>
              <div className="text-[11px] text-dim">
                {w.status === 'error' ? <span className="text-danger">{w.error}</span> : w.events ? t.titleBar.watchUploaded(w.events, formatTime(w.lastEvent ?? Date.now())) : t.titleBar.watchIdle}
              </div>
            </div>
            <IconButton title={t.titleBar.stopWatching} size={26} danger onClick={() => void window.api.watch.stop(w.id)}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </>
  )
}

function ExternalEditsMenu({ onClose }: { onClose: () => void }) {
  const t = useT()
  const extedits = useApp((s) => s.extedits)
  const sessions = useApp((s) => s.sessions)
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div className="absolute right-0 top-9 z-50 w-[360px] card p-2" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-dim">{t.titleBar.editsHeading}</div>
        {extedits.length === 0 && <div className="px-2 py-3 text-muted text-[12.5px]">{t.titleBar.noOpenFiles}</div>}
        {extedits.map((e) => (
          <div key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px]">{e.name}</span>
                {e.status === 'uploading' && <Spinner size={12} />}
                {e.status === 'error' && <CircleAlert size={13} className="text-danger" />}
              </div>
              <div className="text-[11.5px] text-dim truncate" title={e.remotePath}>
                {sessions[e.sessionId]?.name ?? t.common.session} · {e.remotePath}
              </div>
              <div className="text-[11px] text-dim">
                {e.status === 'error'
                  ? e.error
                  : e.uploads
                    ? t.titleBar.editUploaded(e.uploads, formatTime(e.lastUpload ?? Date.now()))
                    : t.titleBar.editIdle}
              </div>
            </div>
            <IconButton title={t.titleBar.uploadNow} size={26} onClick={() => void window.api.extedit.uploadNow(e.id)}>
              <Upload size={14} />
            </IconButton>
            <IconButton title={t.titleBar.finishEditing} size={26} danger onClick={() => void window.api.extedit.close(e.id)}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </>
  )
}
