import { useEffect } from 'react'
import { useApp } from '@/store/app'
import { TitleBar } from './components/TitleBar'
import { ConnectionManager } from './components/home/ConnectionManager'
import { SessionView } from './components/session/SessionView'
import { TransfersPanel } from './components/transfers/TransfersPanel'
import { PromptHost } from './components/PromptHost'
import { DialogHost } from './components/dialogs/DialogHost'
import { ToastHost } from './components/ToastHost'
import { Spinner } from './components/ui'
import { cn } from '@/lib/cn'
import { tr } from '@/lib/i18n'

export default function App() {
  const booted = useApp((s) => s.booted)
  const boot = useApp((s) => s.boot)
  const tabs = useApp((s) => s.tabs)
  const activeTab = useApp((s) => s.activeTab)
  const setActiveTab = useApp((s) => s.setActiveTab)
  const transfersOpen = useApp((s) => s.transfersOpen)
  const openDialog = useApp((s) => s.openDialog)
  const dialog = useApp((s) => s.dialog)
  const pushToast = useApp((s) => s.pushToast)

  useEffect(() => {
    boot().catch((e) => pushToast({ kind: 'error', title: tr().app.bootFailed, message: e instanceof Error ? e.message : String(e) }))
  }, [boot, pushToast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'Tab') {
        e.preventDefault()
        const all = ['home', ...tabs]
        const idx = all.indexOf(activeTab)
        const next = all[(idx + (e.shiftKey ? -1 : 1) + all.length) % all.length]
        setActiveTab(next)
      }
      if (ctrl && e.key === ',') {
        e.preventDefault()
        if (!dialog) openDialog({ kind: 'settings' })
      }
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setActiveTab('home')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activeTab, setActiveTab, openDialog, dialog])

  if (!booted) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg text-text">
      <TitleBar />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 relative">
          <div className={cn('h-full', activeTab !== 'home' && 'hidden')}>
            <ConnectionManager />
          </div>
          {tabs.map((id) => (
            <SessionView key={id} sid={id} visible={activeTab === id} />
          ))}
        </div>
        {transfersOpen && <TransfersPanel />}
      </div>
      <PromptHost />
      <DialogHost />
      <ToastHost />
    </div>
  )
}
