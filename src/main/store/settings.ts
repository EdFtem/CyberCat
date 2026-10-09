import { JsonStore } from './jsonStore'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

const store = new JsonStore<AppSettings>('settings.json', DEFAULT_SETTINGS)

export const settings = {
  get(): AppSettings {
    return store.get()
  },
  set(patch: Partial<AppSettings>): AppSettings {
    return store.update((s) => ({ ...s, ...patch }))
  }
}
