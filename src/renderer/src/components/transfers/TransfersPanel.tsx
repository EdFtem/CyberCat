import { ArrowDown, ArrowUp, Ban, ChevronDown, CircleCheck, CircleX, Eraser, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { formatBytes, formatEta, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { TransferItem } from '@shared/types'
import { Button, IconButton, EmptyState, Spinner } from '../ui'

const api = window.api

export function TransfersPanel() {
  const transfers = useApp((s) => s.transfers)
  const setOpen = useApp((s) => s.setTransfersOpen)
  const items = [...transfers.items].reverse()
  const finished = transfers.items.filter((i) => ['done', 'error', 'cancelled', 'skipped'].includes(i.status)).length
  const pending = transfers.items.filter((i) => ['running', 'queued', 'paused'].includes(i.status)).length
  const totalBytes = transfers.items.filter((i) => i.status !== 'skipped' && i.status !== 'cancelled').reduce((s, i) => s + i.size, 0)
  const doneBytes = transfers.items.filter((i) => i.status !== 'skipped' && i.status !== 'cancelled').reduce((s, i) => s + Math.min(i.transferred, i.size), 0)

  return (
    <div className="flex flex-col h-[260px] shrink-0 border-t border-border bg-surface">
      <div className="flex items-center gap-3 px-3 h-9 border-b border-border">
        <span className="text-[13px] font-medium">Передачі</span>
        <span className="text-[12px] text-dim">
          {pending ? `${pending} в черзі` : 'черга порожня'}
          {transfers.totalSpeed > 0 && ` · ${formatSpeed(transfers.totalSpeed)}`}
        </span>
        {totalBytes > 0 && pending > 0 && (
          <div className="flex items-center gap-2 w-48">
            <div className="progress flex-1">
              <div style={{ width: `${Math.min(100, (doneBytes / totalBytes) * 100)}%` }} />
            </div>
            <span className="text-[11px] text-dim tabular-nums">{Math.floor((doneBytes / totalBytes) * 100)}%</span>
          </div>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={<Ban size={13} />} disabled={!pending} onClick={() => void api.transfer.cancelAll()}>
          Скасувати всі
        </Button>
        <Button size="sm" variant="ghost" icon={<Eraser size={13} />} disabled={!finished} onClick={() => void api.transfer.clearFinished()}>
          Очистити завершені
        </Button>
        <IconButton title="Згорнути" onClick={() => setOpen(false)}>
          <ChevronDown size={16} />
        </IconButton>
      </div>
      <div className="flex-1 overflow-auto">
        {!items.length && <EmptyState title="Передач ще не було" description="Перетягніть файли між панелями або натисніть F5 на вибраних файлах." />}
        {items.map((it) => (
          <TransferRow key={it.id} it={it} />
        ))}
      </div>
    </div>
  )
}

function statusLabel(it: TransferItem): { text: string; tone: string; icon?: React.ReactNode } {
  switch (it.status) {
    case 'running':
      return { text: 'Передається', tone: 'text-accent', icon: <Spinner size={12} /> }
    case 'queued':
      return { text: 'У черзі', tone: 'text-dim' }
    case 'paused':
      return { text: 'Пауза', tone: 'text-warning', icon: <Pause size={12} /> }
    case 'done':
      return { text: 'Готово', tone: 'text-success', icon: <CircleCheck size={12} /> }
    case 'error':
      return { text: it.error ?? 'Помилка', tone: 'text-danger', icon: <CircleX size={12} /> }
    case 'cancelled':
      return { text: 'Скасовано', tone: 'text-dim', icon: <Ban size={12} /> }
    case 'skipped':
      return { text: 'Пропущено', tone: 'text-dim', icon: <SkipForward size={12} /> }
    default:
      return { text: it.status, tone: 'text-dim' }
  }
}

function TransferRow({ it }: { it: TransferItem }) {
  const pct = it.size > 0 ? Math.min(100, (it.transferred / it.size) * 100) : it.status === 'done' ? 100 : 0
  const st = statusLabel(it)
  const active = it.status === 'running' || it.status === 'paused'
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)_200px_auto] items-center gap-3 px-3 h-12 border-b border-border/60 row-hover">
      <span className={cn('inline-flex', it.direction === 'upload' ? 'text-accent' : 'text-success')} title={it.direction === 'upload' ? 'Відвантаження' : 'Завантаження'}>
        {it.direction === 'upload' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="truncate font-medium">{it.name}</span>
          <span className="text-dim text-[11.5px] truncate">· {it.sessionName}</span>
        </div>
        <div className="text-[11.5px] text-dim truncate font-mono" title={`${it.src} → ${it.dst}`}>
          {it.src} → {it.dst}
        </div>
      </div>
      <div className="min-w-0">
        <div className={cn('flex items-center gap-1.5 text-[11.5px] truncate', st.tone)} title={st.text}>
          {st.icon}
          <span className="truncate">{st.text}</span>
        </div>
        {active || it.status === 'queued' ? (
          <>
            <div className="progress mt-1">
              <div style={{ width: `${pct}%`, background: it.status === 'paused' ? 'var(--warning)' : undefined }} />
            </div>
            <div className="flex justify-between text-[11px] text-dim tabular-nums mt-0.5">
              <span>
                {formatBytes(it.transferred)} / {formatBytes(it.size)}
              </span>
              <span>
                {it.status === 'running' && formatSpeed(it.speed)}
                {it.status === 'running' && it.speed > 0 && ` · ${formatEta(it.size - it.transferred, it.speed)}`}
              </span>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-dim tabular-nums mt-0.5">{formatBytes(it.size)}</div>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {it.status === 'running' && (
          <IconButton title="Пауза" size={26} onClick={() => void api.transfer.pause(it.id)}>
            <Pause size={14} />
          </IconButton>
        )}
        {it.status === 'queued' && (
          <IconButton title="Відкласти" size={26} onClick={() => void api.transfer.pause(it.id)}>
            <Pause size={14} />
          </IconButton>
        )}
        {it.status === 'paused' && (
          <IconButton title="Продовжити" size={26} onClick={() => void api.transfer.resume(it.id)}>
            <Play size={14} />
          </IconButton>
        )}
        {(it.status === 'error' || it.status === 'cancelled' || it.status === 'skipped') && (
          <IconButton title="Повторити" size={26} onClick={() => void api.transfer.retry(it.id)}>
            <RotateCcw size={14} />
          </IconButton>
        )}
        {(active || it.status === 'queued') && (
          <IconButton title="Скасувати" size={26} danger onClick={() => void api.transfer.cancel(it.id)}>
            <X size={14} />
          </IconButton>
        )}
        {!active && it.status !== 'queued' && (
          <IconButton title="Прибрати зі списку" size={26} onClick={() => void api.transfer.remove(it.id)}>
            <X size={14} />
          </IconButton>
        )}
      </div>
    </div>
  )
}
