import { safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { JsonStore } from './jsonStore'
import { Profile } from '@shared/types'

interface ProfilesFile {
  profiles: Profile[]
}
interface SecretsFile {
  /** profileId -> base64(зашифровано safeStorage) */
  [id: string]: string
}

const profilesStore = new JsonStore<ProfilesFile>('profiles.json', { profiles: [] })
const secretsStore = new JsonStore<SecretsFile>('secrets.json', {})

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export const profiles = {
  list(): Profile[] {
    const secrets = secretsStore.get()
    return profilesStore
      .get()
      .profiles.map((p) => ({ ...p, hasPassword: !!secrets[p.id] }))
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name))
  },

  get(id: string): Profile | undefined {
    const p = profilesStore.get().profiles.find((x) => x.id === id)
    if (!p) return undefined
    return { ...p, hasPassword: !!secretsStore.get()[id] }
  },

  /**
   * password: undefined = не чіпати, null = видалити, string = зберегти
   */
  save(input: Profile, password?: string | null): Profile {
    const now = Date.now()
    const profile: Profile = {
      ...input,
      id: input.id || randomUUID(),
      createdAt: input.createdAt || now,
      port: Number(input.port) || 22
    }
    delete (profile as Partial<Profile>).hasPassword

    profilesStore.update((f) => {
      const idx = f.profiles.findIndex((p) => p.id === profile.id)
      const next = [...f.profiles]
      if (idx >= 0) next[idx] = profile
      else next.push(profile)
      return { profiles: next }
    })

    if (password === null || !profile.savePassword) this.clearPassword(profile.id)
    else if (typeof password === 'string' && password.length > 0) this.setPassword(profile.id, password)

    return this.get(profile.id)!
  },

  remove(id: string): void {
    profilesStore.update((f) => ({ profiles: f.profiles.filter((p) => p.id !== id) }))
    this.clearPassword(id)
  },

  touch(id: string): void {
    profilesStore.update((f) => ({
      profiles: f.profiles.map((p) => (p.id === id ? { ...p, lastUsedAt: Date.now() } : p))
    }))
  },

  getPassword(id: string | undefined): string | undefined {
    if (!id) return undefined
    const enc = secretsStore.get()[id]
    if (!enc) return undefined
    try {
      if (!canEncrypt()) return undefined
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch (e) {
      console.error('[profiles] не вдалося розшифрувати пароль', e)
      return undefined
    }
  },

  setPassword(id: string, password: string): boolean {
    if (!canEncrypt()) return false
    const enc = safeStorage.encryptString(password).toString('base64')
    secretsStore.update((s) => ({ ...s, [id]: enc }))
    return true
  },

  clearPassword(id: string): void {
    secretsStore.update((s) => {
      const next = { ...s }
      delete next[id]
      return next
    })
  }
}
