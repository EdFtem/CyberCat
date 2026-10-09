import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/cn'

const icons = {
  info: <Info size={16} className="text-accent" />,
  success: <CircleCheck size={16} className="text-success" />,
  warning: <TriangleAlert size={16} className="text-warning" />,
  error: <CircleX size={16} className="text-danger" />
}

export function ToastHost() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="fixed top-12 right-4 z-[60] flex flex-col gap-2 w-[360px] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn('card toast-in pointer-events-auto flex items-start gap-3 px-3.5 py-3', t.kind === 'error' && 'border-danger/40')}
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <div className="mt-0.5 shrink-0">{icons[t.kind]}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-tight">{t.title}</div>
            {t.message && <div className="text-[12.5px] text-muted mt-1 whitespace-pre-wrap break-words">{t.message}</div>}
          </div>
          <button type="button" className="text-dim hover:text-text shrink-0" onClick={() => dismiss(t.id)} title="Закрити">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
