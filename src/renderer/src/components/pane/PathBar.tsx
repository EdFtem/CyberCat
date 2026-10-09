import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useApp, paneTarget, type PaneId } from '@/store/app'
import { pathLib } from '@/lib/paths'
import { cn } from '@/lib/cn'

export function PathBar({ sid, pane, editRequest }: { sid: string; pane: PaneId; editRequest: number }) {
  const path = useApp((s) => s.ui[sid]?.panes[pane].path ?? '')
  const navigate = useApp((s) => s.navigate)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(path)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const target = paneTarget(sid, pane)
  const lib = pathLib(target)

  useEffect(() => {
    if (editRequest > 0) {
      setValue(path)
      setEditing(true)
    }
  }, [editRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [path])

  const segments = lib.segments(path)

  if (editing) {
    return (
      <form
        className="flex-1 min-w-0"
        onSubmit={(e) => {
          e.preventDefault()
          setEditing(false)
          void navigate(sid, pane, value)
        }}
      >
        <input
          ref={inputRef}
          className="input input-mono h-7"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
            }
          }}
          spellCheck={false}
        />
      </form>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-w-0 h-7 flex items-center rounded-md border border-border bg-surface-2 px-1 overflow-x-auto cursor-text"
      style={{ scrollbarWidth: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setValue(path)
          setEditing(true)
        }
      }}
      title={path || 'Цей ПК'}
    >
      {segments.map((seg, i) => {
        const last = i === segments.length - 1
        return (
          <span key={seg.path + i} className="flex items-center shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-dim mx-0.5" />}
            <button
              type="button"
              className={cn(
                'px-1.5 h-[22px] rounded text-[12.5px] font-mono whitespace-nowrap transition-colors',
                last ? 'text-text font-medium' : 'text-muted hover:text-text hover:bg-surface-3'
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (last) {
                  setValue(path)
                  setEditing(true)
                } else void navigate(sid, pane, seg.path)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setValue(path)
                setEditing(true)
              }}
            >
              {seg.label}
            </button>
          </span>
        )
      })}
      <span className="flex-1 min-w-[24px] h-full" />
    </div>
  )
}
