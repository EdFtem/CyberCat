import { useState } from 'react'
import { Fingerprint, ShieldAlert, ShieldCheck, KeyRound, Lock, FileWarning } from 'lucide-react'
import { useApp } from '@/store/app'
import { Button, Checkbox, Field, Modal } from './ui'
import { formatBytes, formatDate } from '@/lib/format'
import type {
  AuthPrompt,
  HostKeyPrompt,
  OverwritePrompt,
  PassphrasePrompt,
  PasswordPrompt,
  PromptRequest
} from '@shared/types'

export function PromptHost() {
  const prompts = useApp((s) => s.prompts)
  const answer = useApp((s) => s.answerPrompt)
  const req = prompts[0]
  if (!req) return null
  const done = (a: unknown): void => void answer(req.id, a)
  switch (req.kind) {
    case 'hostkey':
      return <HostKeyDialog key={req.id} p={req.payload as HostKeyPrompt} done={done} />
    case 'password':
      return <PasswordDialog key={req.id} p={req.payload as PasswordPrompt} done={done} />
    case 'passphrase':
      return <PassphraseDialog key={req.id} p={req.payload as PassphrasePrompt} done={done} />
    case 'auth':
      return <AuthDialog key={req.id} p={req.payload as AuthPrompt} done={done} />
    case 'overwrite':
      return <OverwriteDialog key={req.id} p={req.payload as OverwritePrompt} done={done} />
    default:
      return null
  }
}

type Done = (a: unknown) => void

function HostKeyDialog({ p, done }: { p: HostKeyPrompt; done: Done }) {
  const changed = p.status === 'changed'
  const [remember, setRemember] = useState(!changed)
  return (
    <Modal
      title={changed ? 'Ключ сервера змінився' : 'Невідомий сервер'}
      subtitle={`${p.host}:${p.port}`}
      width={520}
      closable={false}
      footer={
        <>
          <Button onClick={() => done({ accept: false, remember: false })}>Відхилити</Button>
          <Button variant={changed ? 'danger' : 'primary'} onClick={() => done({ accept: true, remember })} data-autofocus>
            {changed ? 'Усе одно підключитися' : 'Підключитися'}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={changed ? 'text-danger' : 'text-accent'}>{changed ? <ShieldAlert size={36} /> : <ShieldCheck size={36} />}</div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[13px] text-muted">
            {changed
              ? 'Відбиток ключа відрізняється від збереженого. Це може означати перевстановлення сервера або атаку посередника. Продовжуйте, лише якщо впевнені.'
              : 'Ви підключаєтесь уперше. Перевірте відбиток ключа з адміністратором сервера, щоб переконатися, що це справжній сервер.'}
          </p>
          <div className="rounded-md bg-surface-2 border border-border p-3 space-y-1.5">
            <Row label="Тип ключа">{p.keyType}</Row>
            <Row label="Відбиток">
              <span className="font-mono text-[12px] break-all select-text">{p.fingerprint}</span>
            </Row>
            {p.previousFingerprint && (
              <Row label="Було">
                <span className="font-mono text-[12px] break-all text-dim select-text">{p.previousFingerprint}</span>
              </Row>
            )}
          </div>
          <Checkbox checked={remember} onChange={setRemember} label={changed ? 'Замінити збережений ключ' : 'Запам’ятати ключ для цього сервера'} />
        </div>
      </div>
    </Modal>
  )
}

function PasswordDialog({ p, done }: { p: PasswordPrompt; done: Done }) {
  const [password, setPassword] = useState('')
  const [save, setSave] = useState(false)
  const submit = (): void => done({ password, save })
  return (
    <Modal
      title="Введіть пароль"
      subtitle={`${p.username}@${p.host}`}
      width={420}
      onClose={() => done({ password: null, save: false })}
      footer={
        <>
          <Button onClick={() => done({ password: null, save: false })}>Скасувати</Button>
          <Button variant="primary" onClick={submit} disabled={!password}>
            Підключитися
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (password) submit()
        }}
        className="space-y-3"
      >
        {p.reason && <p className="text-[12.5px] text-danger">{p.reason}</p>}
        <Field label="Пароль">
          <div className="relative">
            <Lock size={14} className="absolute left-2.5 top-2.5 text-dim" />
            <input className="input pl-8" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
        </Field>
        {p.canSave && <Checkbox checked={save} onChange={setSave} label="Зберегти пароль у профілі (зашифровано системою)" />}
      </form>
    </Modal>
  )
}

function PassphraseDialog({ p, done }: { p: PassphrasePrompt; done: Done }) {
  const [v, setV] = useState('')
  return (
    <Modal
      title="Ключ захищено паролем"
      subtitle={p.keyPath}
      width={420}
      onClose={() => done({ passphrase: null })}
      footer={
        <>
          <Button onClick={() => done({ passphrase: null })}>Скасувати</Button>
          <Button variant="primary" onClick={() => done({ passphrase: v })} disabled={!v}>
            Розблокувати
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (v) done({ passphrase: v })
        }}
      >
        <Field label="Passphrase ключа">
          <div className="relative">
            <KeyRound size={14} className="absolute left-2.5 top-2.5 text-dim" />
            <input className="input pl-8" type="password" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          </div>
        </Field>
      </form>
    </Modal>
  )
}

function AuthDialog({ p, done }: { p: AuthPrompt; done: Done }) {
  const [values, setValues] = useState<string[]>(p.prompts.map(() => ''))
  const submit = (): void => done({ responses: values })
  return (
    <Modal
      title={p.name || 'Додаткова автентифікація'}
      subtitle={`${p.username}@${p.host}`}
      width={440}
      onClose={() => done({ responses: null })}
      footer={
        <>
          <Button onClick={() => done({ responses: null })}>Скасувати</Button>
          <Button variant="primary" onClick={submit}>
            Продовжити
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-3"
      >
        {p.instructions && <p className="text-[12.5px] text-muted whitespace-pre-wrap">{p.instructions}</p>}
        <div className="flex items-center gap-2 text-[12px] text-dim">
          <Fingerprint size={14} /> Сервер вимагає відповідь на запит (пароль, код 2FA тощо)
        </div>
        {p.prompts.map((pr, i) => (
          <Field key={i} label={pr.prompt.replace(/:\s*$/, '')}>
            <input
              className="input"
              type={pr.echo ? 'text' : 'password'}
              value={values[i]}
              autoFocus={i === 0}
              onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </Field>
        ))}
      </form>
    </Modal>
  )
}

function OverwriteDialog({ p, done }: { p: OverwritePrompt; done: Done }) {
  const [all, setAll] = useState(false)
  const name = p.dst.split(/[\\/]/).pop()
  const newer = p.srcMtime > p.dstMtime
  return (
    <Modal
      title="Файл уже існує"
      subtitle={name}
      width={540}
      closable={false}
      footer={
        <>
          <Checkbox checked={all} onChange={setAll} label="Застосувати до всіх" className="mr-auto" />
          <Button onClick={() => done({ action: 'cancel', applyToAll: false })}>Скасувати</Button>
          <Button onClick={() => done({ action: 'skip', applyToAll: all })}>Пропустити</Button>
          {p.canResume && (
            <Button onClick={() => done({ action: 'resume', applyToAll: all })}>Дописати</Button>
          )}
          <Button variant="primary" onClick={() => done({ action: 'overwrite', applyToAll: all })} data-autofocus>
            Перезаписати
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <FileWarning size={32} className="text-warning shrink-0" />
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
          <FileCard title={p.direction === 'upload' ? 'Локальний (джерело)' : 'На сервері (джерело)'} path={p.src} size={p.srcSize} mtime={p.srcMtime} highlight={newer} />
          <FileCard title={p.direction === 'upload' ? 'На сервері (існує)' : 'Локальний (існує)'} path={p.dst} size={p.dstSize} mtime={p.dstMtime} highlight={!newer} />
        </div>
      </div>
      {p.canResume && (
        <p className="text-[12px] text-dim mt-3">Файл призначення менший за джерело. «Дописати» продовжить передачу з поточного розміру.</p>
      )}
    </Modal>
  )
}

function FileCard({ title, path, size, mtime, highlight }: { title: string; path: string; size: number; mtime: number; highlight: boolean }) {
  return (
    <div className="rounded-md bg-surface-2 border border-border p-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-dim mb-1">{title}</div>
      <div className="font-mono text-[11.5px] text-muted truncate select-text" title={path}>
        {path}
      </div>
      <div className="mt-2 text-[13px]">{formatBytes(size)}</div>
      <div className={`text-[12px] ${highlight ? 'text-accent' : 'text-muted'}`}>
        {formatDate(mtime)}
        {highlight && ' · новіший'}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 text-[12.5px]">
      <span className="text-dim">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export type { PromptRequest }
