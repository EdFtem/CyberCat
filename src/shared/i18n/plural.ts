/** English plural: 1 file, 2 files */
export function pluralEn(n: number, one: string, other: string): string {
  return Math.abs(n) === 1 ? one : other
}

/** Ukrainian plural: 1 файл, 2 файли, 5 файлів, 11 файлів, 21 файл */
export function pluralUk(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}
