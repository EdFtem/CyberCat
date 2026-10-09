import { useEffect, useMemo, useState } from 'react'
import { Import, KeyRound, Route } from 'lucide-react'
import { useApp } from '@/store/app'
import { countLabel } from '@/lib/format'
import type { SshConfigHost } from '@shared/types'
import { Badge, Button, Modal, Spinner } from '../ui'

export function SshImportDialog({ close }: { close: () => void }) {
  const loadProfiles = useApp((s) => s.loadProfiles)
  const pushToast = useApp((s) => s.pushToast)
  const [hosts, setHosts] = useState<SshConfigHost[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.sshconfig
      .list()
      .then((h) => {
        setHosts(h)
        setSelected(new Set(h.filter((x) => !x.exists).map((x) => x.alias)))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const allSelected = useMemo(() => !!hosts && hosts.length > 0 && hosts.every((h) => selected.has(h.alias)), [hosts, selected])

  const toggle = (alias: string): void => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(alias)) next.delete(alias)
      else next.add(alias)
      return next
    })
  }

  const run = async (): Promise<void> => {
    if (!selected.size) return
    setBusy(true)
    try {
      const saved = await window.api.sshconfig.import([...selected])
      await loadProfiles()
      pushToast({ kind: 'success', title: 'Імпорт завершено', message: `${countLabel(saved.length, 'профіль', 'профілі', 'профілів')} у групі «ssh config»` })
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const keyName = (p?: string): string => (p ? p.split(/[\\/]/).pop() ?? p : '')

  return (
    <Modal
      title="Імпорт із ~/.ssh/config"
      subtitle="Профілі з ключами, портами й ProxyJump із вашого OpenSSH-конфігу"
      width={720}
      onClose={close}
      footer={
        <>
          {hosts && hosts.length > 0 && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => setSelected(allSelected ? new Set() : new Set(hosts.map((h) => h.alias)))}
            >
              {allSelected ? 'Зняти всі' : 'Вибрати всі'}
            </Button>
          )}
          <Button onClick={close}>Скасувати</Button>
          <Button variant="primary" icon={<Import size={14} />} onClick={() => void run()} disabled={!selected.size} loading={busy}>
            Імпортувати{selected.size ? ` (${selected.size})` : ''}
          </Button>
        </>
      }
    >
      {error && <div className="text-[12.5px] text-danger mb-3">{error}</div>}
      {!hosts && !error && (
        <div className="flex items-center justify-center h-24">
          <Spinner size={22} />
        </div>
      )}
      {hosts && hosts.length === 0 && (
        <div className="p-6 text-center text-[12.5px] text-muted">
          У ~/.ssh/config немає блоків Host з конкретними іменами. Блоки з шаблонами * і ? пропускаються, але їхні опції застосовуються до імпортованих хостів.
        </div>
      )}
      {hosts && hosts.length > 0 && (
        <div className="rounded-md border border-border bg-surface-2 max-h-[420px] overflow-auto">
          {hosts.map((h) => (
            <label key={h.alias} className="flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-surface-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={selected.has(h.alias)} onChange={() => toggle(h.alias)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{h.alias}</span>
                  {h.exists && <Badge tone="neutral">вже є профіль</Badge>}
                </div>
                <div className="text-[11.5px] text-dim font-mono truncate">
                  {h.user ? `${h.user}@` : ''}
                  {h.host}
                  {h.port !== 22 && `:${h.port}`}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11.5px] text-dim shrink-0">
                {h.identityFile && (
                  <span className="inline-flex items-center gap-1" title={h.identityFile}>
                    <KeyRound size={12} /> {keyName(h.identityFile)}
                  </span>
                )}
                {h.proxyJump && (
                  <span className="inline-flex items-center gap-1" title={`ProxyJump ${h.proxyJump}`}>
                    <Route size={12} /> {h.proxyJump}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-dim">Хости без IdentityFile отримають перший знайдений стандартний ключ (id_ed25519, id_ecdsa, id_rsa) або автентифікацію паролем.</p>
    </Modal>
  )
}
