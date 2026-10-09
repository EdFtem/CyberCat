import { useEffect, useMemo, useState } from 'react'
import { Cat, FolderOpen, TriangleAlert } from 'lucide-react'
import { useApp, type Dialog } from '@/store/app'
import { Button, Checkbox, Field, Modal, Segmented } from '../ui'
import { formatBytes, formatDateFull, modeToOctal, modeToString, parseOctal, countLabel } from '@/lib/format'
import { FileIcon } from '@/lib/fileIcons'
import { SearchDialog } from './SearchDialog'
import { SshImportDialog } from './SshImportDialog'
import { CompareDialog } from './CompareDialog'
import { MassRenameDialog } from './MassRenameDialog'
import { CommandDialog } from './CommandDialog'
import type { FileEntry, Target } from '@shared/types'

export function DialogHost() {
  const dialog = useApp((s) => s.dialog)
  const close = useApp((s) => s.closeDialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'input':
      return <InputDialog d={dialog} close={close} />
    case 'confirm':
      return <ConfirmDialog d={dialog} close={close} />
    case 'chmod':
      return <ChmodDialog d={dialog} close={close} />
    case 'properties':
      return <PropertiesDialog target={dialog.target} entry={dialog.entry} close={close} />
    case 'settings':
      return <SettingsDialog close={close} />
    case 'sshImport':
      return <SshImportDialog close={close} />
    case 'search':
      return <SearchDialog sessionId={dialog.sessionId} pane={dialog.pane} close={close} />
    case 'compare':
      return <CompareDialog sessionId={dialog.sessionId} close={close} />
    case 'massRename':
      return <MassRenameDialog sessionId={dialog.sessionId} pane={dialog.pane} entries={dialog.entries} close={close} />
    case 'command':
      return <CommandDialog sessionId={dialog.sessionId} title={dialog.title} cmd={dialog.cmd} close={close} />
    case 'about':
      return <AboutDialog close={close} />
    default:
      return null
  }
}

function InputDialog({ d, close }: { d: Extract<Dialog, { kind: 'input' }>; close: () => void }) {
  const [v, setV] = useState(d.initial ?? '')
  const [busy, setBusy] = useState(false)
  const error = d.validate ? d.validate(v) : null
  const submit = async (): Promise<void> => {
    if (error || busy) return
    setBusy(true)
    try {
      await d.onSubmit(v)
      close()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={d.title}
      width={440}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Скасувати</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!!error || !v.trim()} loading={busy}>
            {d.okLabel ?? 'OK'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={d.label ?? ''} error={v && error ? error : null}>
          <input
            className={`input ${d.mono ? 'input-mono' : ''}`}
            value={v}
            placeholder={d.placeholder}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            spellCheck={false}
            onFocus={(e) => {
              if (d.selectEnd !== undefined) e.target.setSelectionRange(0, d.selectEnd)
              else e.target.select()
            }}
          />
        </Field>
      </form>
    </Modal>
  )
}

function ConfirmDialog({ d, close }: { d: Extract<Dialog, { kind: 'confirm' }>; close: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      await d.onConfirm()
    } finally {
      setBusy(false)
      close()
    }
  }
  return (
    <Modal
      title={d.title}
      width={460}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Скасувати</Button>
          <Button variant={d.danger ? 'danger' : 'primary'} onClick={() => void run()} loading={busy} data-autofocus>
            {d.okLabel ?? 'Підтвердити'}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {d.danger && <TriangleAlert size={28} className="text-danger shrink-0" />}
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{d.message}</p>
          {d.details && (
            <ul className="mt-2 max-h-40 overflow-auto rounded-md bg-surface-2 border border-border p-2 text-[12.5px] font-mono space-y-0.5">
              {d.details.map((x, i) => (
                <li key={i} className="truncate">
                  {x}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

const BITS: { label: string; bits: [number, number, number] }[] = [
  { label: 'Власник', bits: [0o400, 0o200, 0o100] },
  { label: 'Група', bits: [0o040, 0o020, 0o010] },
  { label: 'Інші', bits: [0o004, 0o002, 0o001] }
]

function ChmodDialog({ d, close }: { d: Extract<Dialog, { kind: 'chmod' }>; close: () => void }) {
  const refresh = useApp((s) => s.refresh)
  const pushToast = useApp((s) => s.pushToast)
  const first = d.entries[0]
  const same = d.entries.every((e) => e.mode === first.mode)
  const [mode, setMode] = useState(first.mode & 0o7777)
  const [octal, setOctal] = useState(modeToOctal(first.mode))
  const [recursive, setRecursive] = useState(false)
  const [busy, setBusy] = useState(false)
  const hasDir = d.entries.some((e) => e.isDir)

  const setBit = (bit: number, on: boolean): void => {
    const next = on ? mode | bit : mode & ~bit
    setMode(next)
    setOctal(modeToOctal(next))
  }
  const onOctal = (s: string): void => {
    setOctal(s)
    const p = parseOctal(s)
    if (p !== null) setMode(p)
  }
  const apply = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.fs.chmod(
        d.target,
        d.entries.map((e) => e.path),
        mode,
        recursive
      )
      pushToast({ kind: 'success', title: 'Права змінено', message: `${modeToOctal(mode)} для ${countLabel(d.entries.length, 'елемента', 'елементів', 'елементів')}` })
      void refresh(d.sessionId, d.pane)
      close()
    } catch (e) {
      pushToast({ kind: 'error', title: 'Не вдалося змінити права', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Права доступу"
      subtitle={d.entries.length === 1 ? first.path : `${countLabel(d.entries.length, 'елемент', 'елементи', 'елементів')}${same ? '' : ' · права відрізняються'}`}
      width={460}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Скасувати</Button>
          <Button variant="primary" onClick={() => void apply()} loading={busy} disabled={parseOctal(octal) === null}>
            Застосувати
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto] gap-5 items-start">
        <table className="text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-dim">
              <th className="text-left font-medium pb-2"></th>
              <th className="font-medium pb-2 px-3">Читання</th>
              <th className="font-medium pb-2 px-3">Запис</th>
              <th className="font-medium pb-2 px-3">Виконання</th>
            </tr>
          </thead>
          <tbody>
            {BITS.map((row) => (
              <tr key={row.label}>
                <td className="py-1.5 text-muted">{row.label}</td>
                {row.bits.map((bit) => (
                  <td key={bit} className="text-center px-3">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!(mode & bit)} onChange={(e) => setBit(bit, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-3 w-[132px]">
          <Field label="Octal" error={parseOctal(octal) === null ? 'Напр. 644' : null}>
            <input className="input input-mono text-center" value={octal} onChange={(e) => onOctal(e.target.value)} maxLength={4} />
          </Field>
          <div className="font-mono text-[13px] text-center text-muted rounded-md bg-surface-2 border border-border py-1.5">{modeToString(mode)}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[0o644, 0o664, 0o600, 0o755, 0o775, 0o700, 0o777].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onOctal(modeToOctal(p))}
            className={`kbd !h-6 !px-2 !text-[12px] cursor-pointer hover:border-accent ${mode === p ? '!text-accent !border-accent' : ''}`}
          >
            {modeToOctal(p)}
          </button>
        ))}
      </div>
      {hasDir && <Checkbox className="mt-4" checked={recursive} onChange={setRecursive} label="Застосувати рекурсивно до вмісту тек" />}
    </Modal>
  )
}

function PropertiesDialog({ target, entry, close }: { target: Target; entry: FileEntry; close: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ['Шлях', <span className="font-mono text-[12px] break-all select-text">{entry.path}</span>],
    ['Тип', entry.isDrive ? 'Диск' : entry.isSymlink ? `Символічне посилання${entry.isDir ? ' на теку' : ''}` : entry.isDir ? 'Тека' : 'Файл'],
    ...(entry.linkTarget ? ([['Ціль', <span className="font-mono text-[12px] break-all select-text">{entry.linkTarget}</span>]] as [string, React.ReactNode][]) : []),
    ['Розмір', entry.isDir ? '—' : `${formatBytes(entry.size)} (${entry.size.toLocaleString('uk-UA')} Б)`],
    ['Змінено', formatDateFull(entry.mtime)],
    ['Права', <span className="font-mono">{modeToString(entry.mode)} ({modeToOctal(entry.mode)})</span>],
    ...(entry.owner ? ([['Власник', `${entry.owner}${entry.group ? `:${entry.group}` : ''}`]] as [string, React.ReactNode][]) : []),
    ['Розташування', target === 'local' ? 'Локальний комп\u2019ютер' : 'Сервер']
  ]
  return (
    <Modal title={entry.name} width={480} onClose={close} footer={<Button variant="primary" onClick={close}>Закрити</Button>}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <FileIcon entry={entry} size={40} />
        </div>
        <dl className="flex-1 min-w-0 space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-2 text-[13px]">
              <dt className="text-dim">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  )
}

function SettingsDialog({ close }: { close: () => void }) {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  const [editor, setEditor] = useState(settings.externalEditor)
  const [agent, setAgent] = useState(settings.agentPath)
  const [commands, setCommands] = useState(settings.customCommands)
  useEffect(() => setEditor(settings.externalEditor), [settings.externalEditor])
  const platform = useApp((s) => s.info?.platform)
  const agentHint = useMemo(
    () => (platform === 'win32' ? 'Порожньо = \\\\.\\pipe\\openssh-ssh-agent або SSH_AUTH_SOCK. Для PuTTY вкажіть pageant' : 'Порожньо = SSH_AUTH_SOCK'),
    [platform]
  )
  return (
    <Modal title="Налаштування" width={560} onClose={close} footer={<Button variant="primary" onClick={close}>Готово</Button>}>
      <div className="space-y-5">
        <Field label="Тема">
          <Segmented
            value={settings.theme}
            onChange={(v) => void update({ theme: v })}
            options={[
              { value: 'dark', label: 'Темна' },
              { value: 'light', label: 'Світла' }
            ]}
          />
        </Field>
        <Field
          label="Зовнішній редактор"
          hint={
            <>
              Команда для відкриття файлу. Порожньо = системна програма за замовчуванням. Можна вказати <span className="font-mono">%f</span> для шляху, наприклад{' '}
              <span className="font-mono">code --wait %f</span> або <span className="font-mono">"C:\Program Files\Notepad++\notepad++.exe"</span>.
            </>
          }
        >
          <div className="flex gap-2">
            <input
              className="input input-mono flex-1"
              value={editor}
              placeholder="code --wait"
              onChange={(e) => setEditor(e.target.value)}
              onBlur={() => void update({ externalEditor: editor })}
            />
            <Button
              icon={<FolderOpen size={14} />}
              onClick={async () => {
                const p = await window.api.app.pickFile({ title: 'Оберіть програму', defaultPath: 'C:\\Program Files' })
                if (p) {
                  const cmd = `"${p}"`
                  setEditor(cmd)
                  void update({ externalEditor: cmd })
                }
              }}
            >
              Обрати
            </Button>
          </div>
        </Field>
        <Field label="SSH-агент" hint={agentHint}>
          <input className="input input-mono" value={agent} onChange={(e) => setAgent(e.target.value)} onBlur={() => void update({ agentPath: agent })} placeholder="авто" />
        </Field>
        <Field label="Одночасних передач">
          <Segmented
            value={String(settings.transferConcurrency) as '1' | '2' | '4' | '8'}
            onChange={(v) => void update({ transferConcurrency: Number(v) })}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '4', label: '4' },
              { value: '8', label: '8' }
            ]}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <Checkbox checked={settings.showHidden} onChange={(v) => void update({ showHidden: v })} label="Показувати приховані файли" />
          <Checkbox checked={settings.confirmDelete} onChange={(v) => void update({ confirmDelete: v })} label="Підтверджувати видалення" />
        </div>
        <Field
          label="Користувацькі команди на сервері"
          hint={
            <>
              По одній на рядок: <span className="font-mono">Назва = команда</span>. Плейсхолдери: <span className="font-mono">%f</span> вибрані файли (повні шляхи), <span className="font-mono">%n</span> лише назви,{' '}
              <span className="font-mono">%d</span> поточна тека. З'являються у контекстному меню серверної панелі.
            </>
          }
        >
          <textarea
            className="input input-mono h-[96px] py-2 resize-y"
            value={commands}
            onChange={(e) => setCommands(e.target.value)}
            onBlur={() => void update({ customCommands: commands })}
            placeholder={'Розмір тек = du -sh %f\nПрава рекурсивно 644 = chmod -R 644 %f\nПерезапустити nginx = sudo systemctl restart nginx && systemctl status nginx --no-pager'}
            spellCheck={false}
          />
        </Field>
        <div className="pt-2 border-t border-border flex items-center justify-between text-[12px] text-dim">
          <span>Гарячі клавіші: F2 перейменувати · F4 редагувати · F5 копіювати · F7 нова тека · Del видалити · Ctrl+L шлях · Ctrl+` термінал</span>
        </div>
      </div>
    </Modal>
  )
}

function AboutDialog({ close }: { close: () => void }) {
  const version = useApp((s) => s.info?.version)
  return (
    <Modal title="Про CyberCat" width={400} onClose={close} footer={<Button variant="primary" onClick={close}>Закрити</Button>}>
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-accent text-accent-fg">
          <Cat size={30} />
        </span>
        <div>
          <div className="text-[15px] font-semibold">CyberCat {version}</div>
          <div className="text-[12.5px] text-muted mt-1">Графічний SSH/SFTP файловий менеджер. Electron, React, ssh2, Monaco, xterm.js.</div>
        </div>
      </div>
    </Modal>
  )
}
