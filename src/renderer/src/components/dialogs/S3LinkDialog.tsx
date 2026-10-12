import { useEffect, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import type { FileEntry } from '@shared/types'
import { useApp } from '@/store/app'
import { useT } from '@/lib/i18n'
import { Button, Field, Modal, Segmented, Spinner } from '../ui'

const EXPIRY = { '3600': 3600, '86400': 86400, '604800': 604800 } as const
type Expiry = keyof typeof EXPIRY

/** A presigned GET link: the object stays private, the link works until it expires */
export function S3LinkDialog({ sessionId, entry, close }: { sessionId: string; entry: FileEntry; close: () => void }) {
  const t = useT()
  const pushToast = useApp((s) => s.pushToast)
  const [expiry, setExpiry] = useState<Expiry>('86400')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    setUrl('')
    setError(null)
    setCopied(false)
    window.api.s3
      .presign(sessionId, entry.path, EXPIRY[expiry])
      .then((u) => live && setUrl(u))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [sessionId, entry.path, expiry])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    pushToast({ kind: 'success', title: t.dialogs.shareCopied, message: entry.name })
  }

  return (
    <Modal
      title={t.dialogs.shareTitle}
      subtitle={entry.name}
      width={560}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>{t.common.close}</Button>
          <Button variant="primary" icon={copied ? <Check size={14} /> : <Copy size={14} />} disabled={!url} onClick={() => void copy()}>
            {t.dialogs.shareCopy}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.dialogs.shareExpires}>
          <Segmented<Expiry>
            value={expiry}
            onChange={setExpiry}
            options={[
              { value: '3600', label: t.dialogs.share1h },
              { value: '86400', label: t.dialogs.share1d },
              { value: '604800', label: t.dialogs.share7d }
            ]}
          />
        </Field>
        <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 min-h-[64px]">
          <Link2 size={15} className="text-accent shrink-0 mt-0.5" />
          {error ? (
            <p className="text-[12.5px] text-danger">{error}</p>
          ) : url ? (
            <p className="font-mono text-[12px] break-all select-text text-muted">{url}</p>
          ) : (
            <Spinner size={16} />
          )}
        </div>
        <p className="text-[12.5px] text-dim">{t.dialogs.shareHint}</p>
      </div>
    </Modal>
  )
}
