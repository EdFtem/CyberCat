import { app } from 'electron'
import { JsonStore } from './jsonStore'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'
import { detectLang, type Lang } from '@shared/i18n'

/** Language for a first run, before the user has picked one in Settings */
function systemLang(): Lang {
  const locales: string[] = []
  try {
    locales.push(...app.getPreferredSystemLanguages())
  } catch {
    // not available on this platform or too early in startup
  }
  locales.push(Intl.DateTimeFormat().resolvedOptions().locale)
  return detectLang(locales)
}

const store = new JsonStore<AppSettings>('settings.json', () => ({ ...DEFAULT_SETTINGS, language: systemLang() }))

export const settings = {
  get(): AppSettings {
    return store.get()
  },
  set(patch: Partial<AppSettings>): AppSettings {
    return store.update((s) => ({ ...s, ...patch }))
  }
}
