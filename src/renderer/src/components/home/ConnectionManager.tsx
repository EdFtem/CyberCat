import { useEffect, useMemo, useState } from 'react'
import { Cat, FolderOpen, KeyRound, Lock, Fingerprint, Plus, Search, Server, Trash2, Plug, Save } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/cn'
import type { AuthMethod, Profile } from '@shared/types'
import { Button, Checkbox, Field, Segmented, EmptyState, Kbd } from '../ui'

const COLORS = ['', '#22d3ee', '#34d399', '#fbbf24', '#f97316', '#f87171', '#c084fc', '#60a5fa', '#f472b6']

interface Form {
  id: string
  name: string
  host: string
  port: string
  username: string
  auth: AuthMethod
  keyPath: string
  password: string
  savePassword: boolean
  color: string
  group: string
  remotePath: string
  localPath: string
  createdAt: number
  hasPassword: boolean
}

function emptyForm(): Form {
  return {
    id: '',
    name: '',
    host: '',
    port: '22',
    username: '',
    auth: 'password',
    keyPath: '',
    password: '',
    savePassword: true,
    color: '',
    group: '',
    remotePath: '',
    localPath: '',
    createdAt: 0,
    hasPassword: false
  }
}

function fromProfile(p: Profile): Form {
  return {
    id: p.id,
    name: p.name,
    host: p.host,
    port: String(p.port),
    username: p.username,
    auth: p.auth,
    keyPath: p.keyPath ?? '',
    password: '',
    savePassword: p.savePassword,
    color: p.color ?? '',
    group: p.group ?? '',
    remotePath: p.remotePath ?? '',
    localPath: p.localPath ?? '',
    createdAt: p.createdAt,
    hasPassword: !!p.hasPassword
  }
}

function toProfile(f: Form): Profile {
  return {
    id: f.id,
    name: f.name.trim() || `${f.username.trim()}@${f.host.trim()}`,
    host: f.host.trim(),
    port: Number(f.port) || 22,
    username: f.username.trim(),
    auth: f.auth,
    keyPath: f.auth === 'key' ? f.keyPath.trim() || undefined : undefined,
    savePassword: f.auth === 'password' ? f.savePassword : false,
    color: f.color || undefined,
    group: f.group.trim() || undefined,
    remotePath: f.remotePath.trim() || undefined,
    localPath: f.localPath.trim() || undefined,
    createdAt: f.createdAt
  }
}

export function ConnectionManager() {
  const profiles = useApp((s) => s.profiles)
  const connect = useApp((s) => s.connect)
  const connecting = useApp((s) => s.connecting)
  const saveProfile = useApp((s) => s.saveProfile)
  const deleteProfile = useApp((s) => s.deleteProfile)
  const openDialog = useApp((s) => s.openDialog)
  const pushToast = useApp((s) => s.pushToast)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<Form>(emptyForm())
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (selectedId) {
      const p = profiles.find((x) => x.id === selectedId)
      if (p) setForm(fromProfile(p))
      else setSelectedId(null)
    }
  }, [selectedId, profiles])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = profiles.filter((p) => !q || `${p.name} ${p.host} ${p.username} ${p.group ?? ''}`.toLowerCase().includes(q))
    const map = new Map<string, Profile[]>()
    for (const p of list) {
      const g = p.group?.trim() || ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(p)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  }, [profiles, query])

  const allGroups = useMemo(() => [...new Set(profiles.map((p) => p.group?.trim()).filter(Boolean))] as string[], [profiles])

  const set = (patch: Partial<Form>): void => {
    setForm((f) => ({ ...f, ...patch }))
    setTouched(true)
  }

  const errors = {
    host: form.host.trim() ? null : 'Вкажіть адресу сервера',
    username: form.username.trim() ? null : 'Вкажіть користувача',
    port: /^\d+$/.test(form.port) && Number(form.port) > 0 && Number(form.port) < 65536 ? null : 'Порт від 1 до 65535',
    keyPath: form.auth === 'key' && !form.keyPath.trim() ? 'Оберіть файл ключа' : null
  }
  const valid = !errors.host && !errors.username && !errors.port && !errors.keyPath

  const startNew = (): void => {
    setSelectedId(null)
    setForm(emptyForm())
    setTouched(false)
  }

  const doSave = async (): Promise<Profile | null> => {
    setTouched(true)
    if (!valid) return null
    try {
      const pw = form.auth === 'password' ? (form.password ? form.password : form.savePassword ? undefined : null) : null
      const saved = await saveProfile(toProfile(form), pw)
      setSelectedId(saved.id)
      setForm({ ...fromProfile(saved), password: '' })
      return saved
    } catch (e) {
      pushToast({ kind: 'error', title: 'Не вдалося зберегти профіль', message: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const doConnect = async (): Promise<void> => {
    setTouched(true)
    if (!valid || connecting) return
    if (form.id) {
      const saved = await doSave()
      if (!saved) return
      await connect({ profileId: saved.id, password: form.password || undefined })
    } else {
      await connect({ adHoc: toProfile(form), password: form.password || undefined })
    }
  }

  const doDelete = (p: Profile): void => {
    openDialog({
      kind: 'confirm',
      title: `Видалити профіль ${p.name}?`,
      message: 'Збережений пароль також буде видалено.',
      danger: true,
      okLabel: 'Видалити',
      onConfirm: async () => {
        await deleteProfile(p.id)
        if (selectedId === p.id) startNew()
      }
    })
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Список профілів */}
      <aside className="w-[320px] shrink-0 flex flex-col border-r border-border bg-surface">
        <div className="p-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-[9px] text-dim" />
            <input className="input pl-8" placeholder="Пошук підключень…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant="primary" icon={<Plus size={15} />} onClick={startNew} title="Нове підключення">
            Нове
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2">
          {!profiles.length && (
            <EmptyState icon={<Server size={30} />} title="Ще немає збережених підключень" description="Заповніть форму праворуч і натисніть «Зберегти», або підключіться одразу без збереження." />
          )}
          {groups.map(([group, list]) => (
            <div key={group} className="mb-2">
              {(group || groups.length > 1) && <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-dim">{group || 'Без групи'}</div>}
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id)
                    setTouched(false)
                  }}
                  onDoubleClick={() => void connect({ profileId: p.id })}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    selectedId === p.id ? 'bg-accent-soft' : 'hover:bg-surface-2'
                  )}
                >
                  <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-3 text-muted shrink-0">
                    <Server size={15} />
                    {p.color && <span className="absolute -left-1 top-1 bottom-1 w-[3px] rounded-full" style={{ background: p.color }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name}</span>
                    <span className="block truncate text-[11.5px] text-dim font-mono">
                      {p.username}@{p.host}
                      {p.port !== 22 && `:${p.port}`}
                    </span>
                  </span>
                  <span className="text-dim shrink-0" title={p.auth === 'key' ? 'Ключ' : p.auth === 'agent' ? 'SSH-агент' : 'Пароль'}>
                    {p.auth === 'key' ? <KeyRound size={13} /> : p.auth === 'agent' ? <Fingerprint size={13} /> : <Lock size={13} />}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border text-[11.5px] text-dim flex items-center gap-2">
          <Kbd>Enter</Kbd> у формі підключає · подвійний клік у списку теж
        </div>
      </aside>

      {/* Форма */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-[720px] mx-auto px-8 py-8">
          <div className="flex items-start gap-4 mb-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-fg shrink-0">
              <Cat size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-tight">{form.id ? form.name || 'Профіль' : 'Нове підключення'}</h1>
              <p className="text-[13px] text-muted mt-1">
                {form.id ? 'Змініть параметри та підключіться. Зміни зберігаються при підключенні.' : 'Підключіться одразу або збережіть профіль, щоб повертатися до сервера одним кліком.'}
              </p>
            </div>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              void doConnect()
            }}
          >
            <div className="card p-5 space-y-4">
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <Field label="Хост" error={touched ? errors.host : null}>
                  <input className="input input-mono" placeholder="example.com або 10.0.0.5" value={form.host} onChange={(e) => set({ host: e.target.value })} autoFocus spellCheck={false} />
                </Field>
                <Field label="Порт" error={touched ? errors.port : null}>
                  <input className="input input-mono" value={form.port} onChange={(e) => set({ port: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Користувач" error={touched ? errors.username : null}>
                  <input className="input input-mono" placeholder="root" value={form.username} onChange={(e) => set({ username: e.target.value })} spellCheck={false} />
                </Field>
                <Field label="Назва профілю" hint="Порожньо = користувач@хост">
                  <input className="input" placeholder="Прод-сервер" value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
              </div>

              <Field label="Автентифікація">
                <Segmented
                  value={form.auth}
                  onChange={(v) => set({ auth: v })}
                  options={[
                    { value: 'password', label: 'Пароль', icon: <Lock size={13} /> },
                    { value: 'key', label: 'Ключ', icon: <KeyRound size={13} /> },
                    { value: 'agent', label: 'SSH-агент', icon: <Fingerprint size={13} /> }
                  ]}
                />
              </Field>

              {form.auth === 'password' && (
                <div className="grid grid-cols-2 gap-4 items-end">
                  <Field label="Пароль" hint={form.hasPassword && !form.password ? 'Пароль збережено. Введіть новий, щоб замінити.' : 'Порожньо = запитати при підключенні'}>
                    <input className="input" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder={form.hasPassword ? '••••••••' : ''} />
                  </Field>
                  <Checkbox className="mb-2" checked={form.savePassword} onChange={(v) => set({ savePassword: v })} label="Зберігати пароль (зашифровано системою)" />
                </div>
              )}
              {form.auth === 'key' && (
                <Field label="Приватний ключ" error={touched ? errors.keyPath : null} hint="OpenSSH або PuTTY .ppk. Passphrase буде запитано при підключенні.">
                  <div className="flex gap-2">
                    <input className="input input-mono flex-1" placeholder="C:\Users\you\.ssh\id_ed25519" value={form.keyPath} onChange={(e) => set({ keyPath: e.target.value })} spellCheck={false} />
                    <Button
                      icon={<FolderOpen size={14} />}
                      onClick={async () => {
                        const p = await window.api.app.pickFile({ title: 'Оберіть приватний ключ' })
                        if (p) set({ keyPath: p })
                      }}
                    >
                      Обрати
                    </Button>
                  </div>
                </Field>
              )}
              {form.auth === 'agent' && <p className="text-[12.5px] text-muted">Ключі беруться з OpenSSH ssh-agent або Pageant. Шлях до агента можна змінити у налаштуваннях.</p>}
            </div>

            <div className="card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Стартова тека на сервері" hint="Порожньо = домашня тека">
                  <input className="input input-mono" placeholder="/var/www" value={form.remotePath} onChange={(e) => set({ remotePath: e.target.value })} spellCheck={false} />
                </Field>
                <Field label="Локальна стартова тека" hint="Порожньо = домашня тека">
                  <div className="flex gap-2">
                    <input className="input input-mono flex-1" value={form.localPath} onChange={(e) => set({ localPath: e.target.value })} spellCheck={false} />
                    <Button
                      icon={<FolderOpen size={14} />}
                      onClick={async () => {
                        const p = await window.api.app.pickDirectory({ title: 'Локальна тека' })
                        if (p) set({ localPath: p })
                      }}
                    />
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Група" hint="Для групування у списку, напр. «Прод»">
                  <input className="input" list="cc-groups" value={form.group} onChange={(e) => set({ group: e.target.value })} />
                  <datalist id="cc-groups">
                    {allGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Колір мітки">
                  <div className="flex items-center gap-1.5 h-8">
                    {COLORS.map((c) => (
                      <button
                        key={c || 'none'}
                        type="button"
                        onClick={() => set({ color: c })}
                        className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-110', form.color === c ? 'border-text' : 'border-transparent')}
                        style={{ background: c || 'var(--surface-4)' }}
                        title={c || 'Без кольору'}
                      />
                    ))}
                  </div>
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" icon={<Plug size={15} />} loading={connecting} disabled={touched && !valid}>
                Підключитися
              </Button>
              <Button icon={<Save size={15} />} onClick={() => void doSave()} disabled={touched && !valid}>
                {form.id ? 'Зберегти зміни' : 'Зберегти профіль'}
              </Button>
              <span className="flex-1" />
              {form.id && (
                <Button variant="ghost" icon={<Trash2 size={15} />} className="text-danger hover:!bg-danger-soft" onClick={() => doDelete(toProfile(form))}>
                  Видалити
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
