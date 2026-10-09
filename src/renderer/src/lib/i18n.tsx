import { Fragment, type ReactNode } from 'react'
import { create } from 'zustand'
import { getMessages, INTL_LOCALE, type Lang, type Messages } from '@shared/i18n'

const useLangStore = create<{ lang: Lang }>(() => ({ lang: 'en' }))

/** Called by the app store on boot and whenever the language setting changes */
export function setLang(lang: Lang): void {
  document.documentElement.lang = lang
  useLangStore.setState({ lang })
}

export function currentLang(): Lang {
  return useLangStore.getState().lang
}

/** Locale for Intl date and number formatting */
export function intlLocale(): string {
  return INTL_LOCALE[currentLang()]
}

/** Messages for the current language outside React: store actions, ops, helpers */
export function tr(): Messages {
  return getMessages(currentLang())
}

/** Messages for the current language; the component re-renders when the language changes */
export function useT(): Messages {
  return getMessages(useLangStore((s) => s.lang))
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang)
}

const TAG = /<(\w+)>(.*?)<\/\1>/g

/**
 * Renders a message with inline tags, so a sentence stays whole for translators:
 * rich('Use <code>%f</code> for the path', { code: (s) => <span className="font-mono">{s}</span> })
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const render = tags[m[1]]
    out.push(<Fragment key={out.length}>{render ? render(m[2]) : m[2]}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
