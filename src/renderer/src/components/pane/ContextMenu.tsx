import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type MenuItem =
  | { type: 'separator' }
  | {
      type?: 'item'
      label: string
      icon?: ReactNode
      shortcut?: string
      danger?: boolean
      disabled?: boolean
      checked?: boolean
      onClick: () => void
    }

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = Math.min(x, window.innerWidth - r.width - 8)
    const ny = Math.min(y, window.innerHeight - r.height - 8)
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (): void => onClose()
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('wheel', onScroll, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('wheel', onScroll)
    }
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-[70]" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        className="fixed z-[71] min-w-[220px] card p-1 modal-in"
        style={{ left: pos.x, top: pos.y, boxShadow: 'var(--shadow)' }}
      >
        {items.map((it, i) =>
          it.type === 'separator' ? (
            <div key={i} className="my-1 h-px bg-border" />
          ) : (
            <button
              key={i}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                onClose()
                it.onClick()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 h-[30px] text-left text-[13px] transition-colors',
                'disabled:opacity-40 disabled:pointer-events-none',
                it.danger ? 'text-danger hover:bg-danger-soft' : 'hover:bg-surface-3'
              )}
            >
              <span className={cn('w-4 flex items-center justify-center shrink-0', it.danger ? 'text-danger' : 'text-muted')}>
                {it.checked ? '✓' : it.icon}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {it.shortcut && <span className="text-[11px] text-dim font-mono ml-4">{it.shortcut}</span>}
            </button>
          )
        )}
      </div>
    </>
  )
}
