import type { format as en } from '../en/format'

export const format: typeof en = {
  bytes: 'Б',
  units: ['КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'],
  perSecond: '/с',
  seconds: (s) => `${s} с`,
  minutesSeconds: (m, s) => `${m} хв ${s} с`,
  hoursMinutes: (h, m) => `${h} год ${m} хв`
}
