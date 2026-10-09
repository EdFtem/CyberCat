import type { logView as en } from '../en/logView'
import { pluralUk } from '../../plural'

export const logView: typeof en = {
  resume: (n) => `Продовжити (${n} ${pluralUk(n, 'новий', 'нові', 'нових')})`,
  pause: 'Пауза',
  autoScroll: 'Автопрокрутка до кінця',
  wrap: 'Перенесення довгих рядків',
  clear: 'Очистити вікно',
  filterPlaceholder: 'Фільтр рядків…',

  lineCount: (n) => `${n} ${pluralUk(n, 'рядок', 'рядки', 'рядків')}`,
  lineCountFiltered: (shown, total) => `${shown} з ${total} ${pluralUk(total, 'рядка', 'рядків', 'рядків')}`,
  pausedPending: (n) => `+${n} на паузі`,
  stopped: 'зупинено',

  noMatches: 'Немає рядків за фільтром',
  waiting: 'Очікуємо даних…'
}
