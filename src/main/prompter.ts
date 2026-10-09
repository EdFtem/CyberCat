import { randomUUID } from 'crypto'
import { broadcast } from './broadcast'
import { PromptKind, PromptRequest } from '@shared/types'

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

const pending = new Map<string, Pending>()

/** Показати діалог у renderer і дочекатися відповіді */
export function prompt<A>(kind: PromptKind, payload: PromptRequest['payload']): Promise<A> {
  const id = randomUUID()
  return new Promise<A>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    broadcast('prompt:request', { id, kind, payload } satisfies PromptRequest)
  })
}

export function answerPrompt(id: string, answer: unknown): void {
  const p = pending.get(id)
  if (!p) return
  pending.delete(id)
  p.resolve(answer)
}

export function rejectAllPrompts(reason = 'Скасовано'): void {
  for (const [id, p] of pending) {
    pending.delete(id)
    p.reject(new Error(reason))
  }
}
