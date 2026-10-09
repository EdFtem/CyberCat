import { useEffect, useRef } from 'react'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import type { Toast } from '@shared/types'

const icons = {
  info: <Info size={16} className="text-accent" />,
  success: <CircleCheck size={16} className="text-success" />,
  warning: <TriangleAlert size={16} className="text-warning" />,
  error: <CircleX size={16} className="text-danger" />
}

/** Errors stay longer: they usually carry a message worth reading */
const LIFETIME: Record<Toast['kind'], number> = { info: 5000, success: 4000, warning: 7000, error: 10000 }

export function ToastHost() {
  const toasts = useApp((s) => s.toasts)
  if (!toasts.length) return null
  // Bottom right, above the status bar, so toasts never cover pane toolbars
  return (
    <div className="fixed bottom-10 right-4 z-[60] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-32px)] pointer-events-none" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const t = useT()
  const dismiss = useApp((s) => s.dismissToast)
  const timer = useRef<number | undefined>(undefined)
  const remaining = useRef(LIFETIME[toast.kind])
  const startedAt = useRef(0)

  const start = (): void => {
    window.clearTimeout(timer.current)
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => dismiss(toast.id), remaining.current)
  }
  const pause = (): void => {
    window.clearTimeout(timer.current)
    remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current))
  }

  // A toast pushed again with the same id (progress updates) gets a fresh lifetime
  useEffect(() => {
    remaining.current = LIFETIME[toast.kind]
    start()
    return () => window.clearTimeout(timer.current)
  }, [toast])

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={cn('card toast-in pointer-events-auto flex items-start gap-3 px-3.5 py-3', toast.kind === 'error' && 'border-danger/40')}
      style={{ boxShadow: 'var(--shadow)' }}
      onMouseEnter={pause}
      onMouseLeave={start}
    >
      <div className="mt-0.5 shrink-0">{icons[toast.kind]}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-tight">{toast.title}</div>
        {toast.message && <div className="text-[12.5px] text-muted mt-1 whitespace-pre-wrap break-words select-text">{toast.message}</div>}
      </div>
      <button type="button" className="text-dim hover:text-text shrink-0" onClick={() => dismiss(toast.id)} title={t.common.close}>
        <X size={14} />
      </button>
    </div>
  )
}
