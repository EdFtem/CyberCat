export const format = {
  bytes: 'B',
  /** KB, MB, GB, TB, PB */
  units: ['KB', 'MB', 'GB', 'TB', 'PB'],
  perSecond: '/s',
  seconds: (s: number) => `${s} s`,
  minutesSeconds: (m: number, s: number) => `${m} min ${s} s`,
  hoursMinutes: (h: number, m: number) => `${h} h ${m} min`
}
