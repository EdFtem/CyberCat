export function formatBytes(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} Б`
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ']
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
  return `${formatBytes(bps)}/с`
}

export function formatEta(remaining: number, speed: number): string {
  if (!speed || speed <= 0 || remaining <= 0) return ''
  const s = Math.round(remaining / speed)
  if (s < 60) return `${s} с`
  if (s < 3600) return `${Math.floor(s / 60)} хв ${s % 60} с`
  return `${Math.floor(s / 3600)} год ${Math.floor((s % 3600) / 60)} хв`
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
const timeFmt = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' })

export function formatDate(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFmt.format(d)
}

export function formatTime(ms: number): string {
  return timeFmt.format(new Date(ms))
}

export function formatDateFull(ms: number): string {
  if (!ms) return '—'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(ms))
}

/** 0o755 -> rwxr-xr-x (з урахуванням setuid/setgid/sticky) */
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

export function pluralUk(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${pluralUk(n, one, few, many)}`
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0) return ''
  return name.slice(i + 1).toLowerCase()
}
