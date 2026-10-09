import { en, type Messages } from './locales/en'
import { uk } from './locales/uk'

export type { Messages }
export { pluralEn, pluralUk } from './plural'

export type Lang = 'en' | 'uk'

/** Languages offered in Settings, each labelled in its own language */
export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' }
]

/** Locale for Intl date and number formatting */
export const INTL_LOCALE: Record<Lang, string> = { en: 'en-US', uk: 'uk-UA' }

const DICTIONARIES: Record<Lang, Messages> = { en, uk }

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && v in DICTIONARIES
}

export function getMessages(lang: Lang): Messages {
  return DICTIONARIES[lang] ?? en
}

/** First run: Ukrainian if the system prefers it, English otherwise */
export function detectLang(locales: readonly string[]): Lang {
  for (const l of locales) {
    const base = l.toLowerCase().split(/[-_]/)[0]
    if (isLang(base)) return base
  }
  return 'en'
}
