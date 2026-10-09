import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn('btn', `btn-${variant}`, size === 'sm' && 'h-7 px-2.5 text-[12.5px]', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <LoaderCircle size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  danger?: boolean
  size?: number
}

export function IconButton({ active, danger, size = 28, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors no-drag',
        'text-muted hover:text-text hover:bg-surface-3 disabled:opacity-40 disabled:pointer-events-none',
        active && 'bg-accent-soft text-accent hover:text-accent',
        danger && 'hover:text-danger hover:bg-danger-soft',
        className
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn('animate-spin text-accent', className)} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}

export function Field({
  label,
  hint,
  error,
  children,
  className
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-[12px] font-medium text-muted mb-1">{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] text-danger mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[12px] text-dim mt-1">{hint}</span>
      ) : null}
    </label>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none self-start', disabled && 'opacity-50 pointer-events-none', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="text-[13px]">{label}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-md p-0.5 bg-surface-2 border border-border', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12.5px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose,
  width = 480,
  closable = true
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose?: () => void
  width?: number
  closable?: boolean
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && closable && onClose) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closable, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closable) onClose?.()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="card modal-in flex flex-col max-h-[85vh]"
        style={{ width, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--shadow)' }}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {subtitle && <div className="text-[12.5px] text-muted mt-1">{subtitle}</div>}
          </div>
          {closable && onClose && (
            <IconButton onClick={onClose} title={t.common.close} size={26}>
              <X size={16} />
            </IconButton>
          )}
        </div>
        <div className="px-5 pb-4 overflow-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  children
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6 py-10">
      {icon && <div className="text-dim mb-3">{icon}</div>}
      <div className="text-[14px] font-medium">{title}</div>
      {description && <div className="text-[12.5px] text-muted mt-1 max-w-[360px]">{description}</div>}
      {children && <div className="mt-4 flex gap-2">{children}</div>}
    </div>
  )
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const color =
    status === 'connected'
      ? 'bg-success'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-warning pulse'
        : status === 'error'
          ? 'bg-danger'
          : 'bg-dim'
  return <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', color, className)} />
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' }) {
  const cls = {
    neutral: 'bg-surface-3 text-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-warning'
  }[tone]
  return <span className={cn('inline-flex items-center rounded px-1.5 h-[18px] text-[11px] font-medium', cls)}>{children}</span>
}
