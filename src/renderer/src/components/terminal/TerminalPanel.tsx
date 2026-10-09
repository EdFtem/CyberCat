import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal as TerminalIcon, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { tr, useT } from '@/lib/i18n'
import { IconButton } from '../ui'

const api = window.api

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function TerminalPanel({ sid }: { sid: string }) {
  const t = useT()
  const session = useApp((s) => s.sessions[sid])
  const toggle = useApp((s) => s.toggleTerminal)
  const setTerminalId = useApp((s) => s.setTerminalId)
  const theme = useApp((s) => s.settings.theme)
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let termId: string | undefined

    const term = new Terminal({
      fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
      theme: {
        background: cssVar('--terminal-bg') || '#0a0e15',
        foreground: '#e6eaf0',
        cursor: '#22d3ee',
        selectionBackground: '#22d3ee40',
        black: '#1d2635',
        brightBlack: '#647389',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e6eaf0'
      }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)
    termRef.current = term
    try {
      fit.fit()
    } catch {
      /* ignore */
    }

    const uiState = useApp.getState().ui[sid]
    const cwd = uiState?.panes.remote.path
    const command = uiState?.terminalCommand
    if (command) useApp.getState().setTerminalCommand(sid, undefined)
    term.writeln(`\x1b[90m${tr().terminal.connecting(session?.host)}\x1b[0m`)

    const offData = api.on.terminalData(({ termId: id, data }) => {
      if (id === termId) term.write(data)
    })
    const offExit = api.on.terminalExit(({ termId: id }) => {
      if (id !== termId) return
      term.writeln(`\r\n\x1b[90m${tr().terminal.sessionEnded}\x1b[0m`)
      termId = undefined
      setTerminalId(sid, undefined)
    })

    api.terminal
      .open(sid, term.cols, term.rows, cwd, command)
      .then((id) => {
        if (cancelled) {
          void api.terminal.close(id)
          return
        }
        termId = id
        setTerminalId(sid, id)
      })
      .catch((e) => {
        term.writeln(`\x1b[31m${tr().terminal.openFailed(e instanceof Error ? e.message : String(e))}\x1b[0m`)
      })

    const onDataDisp = term.onData((d) => {
      if (termId) api.terminal.write(termId, d)
    })
    const onResizeDisp = term.onResize(({ cols, rows }) => {
      if (termId) api.terminal.resize(termId, cols, rows)
    })
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* ignore */
      }
    })
    ro.observe(host)
    term.focus()

    return () => {
      cancelled = true
      ro.disconnect()
      offData()
      offExit()
      onDataDisp.dispose()
      onResizeDisp.dispose()
      if (termId) void api.terminal.close(termId)
      setTerminalId(sid, undefined)
      term.dispose()
      termRef.current = null
    }
  }, [sid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const xterm = termRef.current
    if (!xterm) return
    xterm.options.theme = { ...xterm.options.theme, background: cssVar('--terminal-bg') || '#0a0e15' }
  }, [theme])

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border overflow-hidden" style={{ background: 'var(--terminal-bg)' }}>
      <div className="flex items-center gap-2 px-3 h-8 border-b border-border/60 text-[12px] text-muted shrink-0" style={{ background: 'var(--surface)' }}>
        <TerminalIcon size={13} className="text-accent" />
        <span className="font-medium text-text">{t.terminal.title}</span>
        <span className="text-dim font-mono">
          {session?.username}@{session?.host}
        </span>
        <span className="flex-1" />
        <span className="text-dim">{t.terminal.hideHint}</span>
        <IconButton title={t.terminal.close} size={24} onClick={() => toggle(sid)}>
          <X size={14} />
        </IconButton>
      </div>
      <div ref={hostRef} className="flex-1 min-h-0" onMouseDown={() => termRef.current?.focus()} />
    </div>
  )
}
