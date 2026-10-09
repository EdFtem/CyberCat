import { currentLang, intlLocale, tr } from './i18n'
import type { Lang } from '@shared/i18n'

export function formatBytes(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  const f = tr().format
  if (n < 1024) return `${n} ${f.bytes}`
  const units = f.units
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : digits)} ${units[i]}`
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return ''
  return `${formatBytes(bps)}${tr().format.perSecond}`
}

export function formatEta(remaining: number, speed: number): string {
  if (!speed || speed <= 0 || remaining <= 0) return ''
  const f = tr().format
  const s = Math.round(remaining / speed)
  if (s < 60) return f.seconds(s)
  if (s < 3600) return f.minutesSeconds(Math.floor(s / 60), s % 60)
  return f.hoursMinutes(Math.floor(s / 3600), Math.floor((s % 3600) / 60))
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatters = new Map<Lang, { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat; full: Intl.DateTimeFormat }>()

function fmt(): { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat; full: Intl.DateTimeFormat } {
  const lang = currentLang()
  let f = formatters.get(lang)
  if (!f) {
    const locale = intlLocale()
    f = {
      date: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      full: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'medium', hourCycle: 'h23' })
    }
    formatters.set(lang, f)
  }
  return f
}

export function formatDate(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  // English: ISO-style date, unambiguous for readers in any region
  if (currentLang() === 'en') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return fmt().date.format(d)
}

export function formatTime(ms: number): string {
  return fmt().time.format(new Date(ms))
}

export function formatDateFull(ms: number): string {
  if (!ms) return '—'
  return fmt().full.format(new Date(ms))
}

/** Grouped integer in the current locale: 1,234,567 or 1 234 567 */
export function formatNumber(n: number): string {
  return n.toLocaleString(intlLocale())
}

/** 0o755 -> rwxr-xr-x (including setuid/setgid/sticky) */
export function modeToString(mode: number): string {
  const r = (b: number): string => (b ? 'r' : '-')
  const w = (b: number): string => (b ? 'w' : '-')
  const x = (b: number, special: number, ch: string): string =>
    special ? (b ? ch : ch.toUpperCase()) : b ? 'x' : '-'
  return (
    r(mode & 0o400) +
    w(mode & 0o200) +
    x(mode & 0o100, mode & 0o4000, 's') +
    r(mode & 0o040) +
    w(mode & 0o020) +
    x(mode & 0o010, mode & 0o2000, 's') +
    r(mode & 0o004) +
    w(mode & 0o002) +
    x(mode & 0o001, mode & 0o1000, 't')
  )
}

export function modeToOctal(mode: number): string {
  return (mode & 0o7777).toString(8).padStart(mode & 0o7000 ? 4 : 3, '0')
}

export function parseOctal(s: string): number | null {
  const t = s.trim()
  if (!/^[0-7]{3,4}$/.test(t)) return null
  return parseInt(t, 8)
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0) return ''
  return name.slice(i + 1).toLowerCase()
}
