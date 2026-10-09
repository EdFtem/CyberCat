import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Eraser, Pause, Play, Search, WrapText } from 'lucide-react'
import type { EditorDoc } from '@/store/app'
import type { TailData } from '@shared/types'
import { cn } from '@/lib/cn'
import { IconButton, Badge } from '../ui'

const MAX_LINES = 5000
const ROW = 20
const OVERSCAN = 10

type Level = 'error' | 'warn' | 'info' | 'debug' | null

function levelOf(line: string): Level {
  if (/\b(ERROR|ERR|FATAL|CRIT|CRITICAL|PANIC|EMERG|ALERT|SEVERE)\b/i.test(line)) return 'error'
  if (/\b(WARN|WARNING)\b/i.test(line)) return 'warn'
  if (/\b(DEBUG|TRACE|VERBOSE)\b/i.test(line)) return 'debug'
  if (/\b(INFO|NOTICE)\b/i.test(line)) return 'info'
  return null
}

const levelClass: Record<Exclude<Level, null>, string> = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-text',
  debug: 'text-dim'
}

/** Живий перегляд логу: рядки приходять подіями tail:data, історія підтягується знімком */
export function LogView({ doc }: { doc: EditorDoc }) {
  const [lines, setLines] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const [follow, setFollow] = useState(true)
  const [wrap, setWrap] = useState(false)
  const [filter, setFilter] = useState('')
  const [live, setLive] = useState(true)
  const [exitError, setExitError] = useState<string | undefined>()
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)

  const pausedRef = useRef(false)
  const pendingRef = useRef<string[]>([])
  const partialRef = useRef('')
  const queueRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])
  useEffect(() => {
    followRef.current = follow
  }, [follow])

  const appendLines = useCallback((parts: string[]) => {
    if (!parts.length) return
    setLines((prev) => {
      const merged = prev.length + parts.length > MAX_LINES ? [...prev.slice(prev.length + parts.length - MAX_LINES), ...parts] : [...prev, ...parts]
      return merged
    })
  }, [])

  const flush = useCallback(() => {
    rafRef.current = null
    const text = queueRef.current
    queueRef.current = ''
    if (!text) return
    const combined = partialRef.current + text.replace(/\r\n?/g, '\n')
    const parts = combined.split('\n')
    partialRef.current = parts.pop() ?? ''
    if (!parts.length) return
    if (pausedRef.current) {
      pendingRef.current.push(...parts)
      if (pendingRef.current.length > MAX_LINES) pendingRef.current = pendingRef.current.slice(-MAX_LINES)
      return
    }
    appendLines(parts)
  }, [appendLines])

  const schedule = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  useEffect(() => {
    const tailId = doc.tailId
    if (!tailId) return
    let disposed = false
    let ready = false
    let lastSeq = 0
    const early: TailData[] = []

    const offData = window.api.on.tailData((d) => {
      if (d.tailId !== tailId) return
      if (!ready) {
        early.push(d)
        return
      }
      if (d.seq <= lastSeq) return
      lastSeq = d.seq
      queueRef.current += d.data
      schedule()
    })
    const offExit = window.api.on.tailExit((d) => {
      if (d.tailId !== tailId) return
      setLive(false)
      setExitError(d.error)
    })
    window.api.tail
      .snapshot(tailId)
      .then((snap) => {
        if (disposed) return
        lastSeq = snap.seq
        queueRef.current += snap.text
        for (const d of early.sort((a, b) => a.seq - b.seq)) {
          if (d.seq > lastSeq) {
            lastSeq = d.seq
            queueRef.current += d.data
          }
        }
        ready = true
        schedule()
      })
      .catch(() => {
        ready = true
      })

    return () => {
      disposed = true
      offData()
      offExit()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [doc.tailId, schedule])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    setHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? lines.filter((l) => l.toLowerCase().includes(f)) : lines
  }, [lines, filter])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && followRef.current) el.scrollTop = el.scrollHeight
  }, [visible.length, wrap])

  const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    setScrollTop(el.scrollTop)
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - ROW
    if (atBottom !== follow) setFollow(atBottom)
  }

  const togglePause = (): void => {
    if (paused) {
      const pending = pendingRef.current
      pendingRef.current = []
      appendLines(pending)
    }
    setPaused(!paused)
  }

  const total = visible.length
  const startIdx = wrap ? 0 : Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN)
  const endIdx = wrap ? total : Math.min(total, Math.ceil((scrollTop + height) / ROW) + OVERSCAN)
  const slice = visible.slice(startIdx, endIdx)
  const pendingCount = pendingRef.current.length

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border">
        <IconButton title={paused ? `Продовжити (${pendingCount} нових)` : 'Пауза'} active={paused} onClick={togglePause}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </IconButton>
        <IconButton
          title="Автопрокрутка до кінця"
          active={follow}
          onClick={() => {
            setFollow(true)
            const el = scrollRef.current
            if (el) el.scrollTop = el.scrollHeight
          }}
        >
          <ArrowDownToLine size={15} />
        </IconButton>
        <IconButton title="Перенесення довгих рядків" active={wrap} onClick={() => setWrap((w) => !w)}>
          <WrapText size={15} />
        </IconButton>
        <IconButton
          title="Очистити вікно"
          onClick={() => {
            setLines([])
            pendingRef.current = []
          }}
        >
          <Eraser size={15} />
        </IconButton>
        <span className="w-px h-5 bg-border mx-1" />
        <div className="relative flex-1 max-w-[360px]">
          <Search size={13} className="absolute left-2.5 top-[8px] text-dim" />
          <input className="input h-7 pl-7" placeholder="Фільтр рядків…" value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} />
        </div>
        <span className="flex-1" />
        <span className="text-[11.5px] text-dim tabular-nums">
          {total}
          {filter && ` з ${lines.length}`} рядків
          {paused && pendingCount > 0 && ` · +${pendingCount} на паузі`}
        </span>
        {live ? <Badge tone="success">live</Badge> : <Badge tone={exitError ? 'danger' : 'neutral'}>{exitError ?? 'зупинено'}</Badge>}
      </div>

      <div
        ref={scrollRef}
        className={cn('flex-1 min-h-0 overflow-auto py-1 font-mono text-[12px] leading-5 select-text', !wrap && 'overflow-x-auto')}
        onScroll={onScroll}
      >
        {total === 0 && <div className="px-3 py-6 text-dim text-center font-sans text-[12.5px]">{filter ? 'Немає рядків за фільтром' : 'Очікуємо даних…'}</div>}
        {!wrap && <div style={{ height: startIdx * ROW }} />}
        {slice.map((line, i) => {
          const lvl = levelOf(line)
          return (
            <div key={startIdx + i} className={cn('px-3', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre h-5', lvl ? levelClass[lvl] : 'text-muted')}>
              {line || ' '}
            </div>
          )
        })}
        {!wrap && <div style={{ height: Math.max(0, (total - endIdx) * ROW) }} />}
      </div>
    </div>
  )
}
