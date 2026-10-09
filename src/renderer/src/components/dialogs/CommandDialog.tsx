import { useEffect, useState } from 'react'
import { Copy, TerminalSquare } from 'lucide-react'
import { useApp } from '@/store/app'
import type { ExecOutput } from '@shared/types'
import { useT } from '@/lib/i18n'
import { Badge, Button, Modal, Spinner } from '../ui'

/** Runs a custom command on the server and shows its output */
export function CommandDialog({ sessionId, title, cmd, close }: { sessionId: string; title: string; cmd: string; close: () => void }) {
  const t = useT()
  const refresh = useApp((s) => s.refresh)
  const [out, setOut] = useState<ExecOutput | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    window.api.sessions
      .exec(sessionId, cmd)
      .then((r) => {
        if (disposed) return
        setOut(r)
        void refresh(sessionId, 'remote')
      })
      .catch((e) => !disposed && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      disposed = true
    }
  }, [sessionId, cmd, refresh])

  const text = out ? [out.stdout, out.stderr].filter(Boolean).join('\n') : ''

  return (
    <Modal
      title={title}
      subtitle={<span className="font-mono text-[12px] break-all select-text">{cmd}</span>}
      width={820}
      onClose={close}
      footer={
        <>
          <span className="mr-auto">
            {out && <Badge tone={out.code === 0 ? 'success' : 'danger'}>{t.command.exitCode(out.code)}</Badge>}
            {!out && !error && <Badge tone="accent">{t.command.statusRunning}</Badge>}
          </span>
          <Button icon={<Copy size={14} />} onClick={() => void navigator.clipboard.writeText(text)} disabled={!text}>
            {t.command.copyOutput}
          </Button>
          <Button variant="primary" onClick={close}>
            {t.common.close}
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-border bg-[var(--terminal-bg)] text-[#e6eaf0] font-mono text-[12px] leading-5 p-3 min-h-[160px] max-h-[460px] overflow-auto whitespace-pre-wrap break-words select-text">
        {!out && !error && (
          <span className="inline-flex items-center gap-2 text-[#9aa8bb]">
            <Spinner size={14} /> <TerminalSquare size={14} /> {t.command.running}
          </span>
        )}
        {error && <span className="text-danger">{error}</span>}
        {out && (
          <>
            {out.stdout}
            {out.stderr && <span className="text-warning">{out.stderr}</span>}
            {!out.stdout && !out.stderr && <span className="text-[#647389]">{t.command.noOutput}</span>}
          </>
        )}
      </div>
    </Modal>
  )
}
