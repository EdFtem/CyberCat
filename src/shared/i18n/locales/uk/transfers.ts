import type { transfers as en } from '../en/transfers'

export const transfers: typeof en = {
  title: 'Передачі',
  queued: (n) => `${n} в черзі`,
  queueEmpty: 'черга порожня',
  cancelAll: 'Скасувати всі',
  clearFinished: 'Очистити завершені',
  collapse: 'Згорнути',
  emptyTitle: 'Передач ще не було',
  emptyDescription: 'Перетягніть файли між панелями або натисніть F5 на вибраних файлах.',

  status: {
    running: 'Передається',
    queued: 'У черзі',
    paused: 'Пауза',
    done: 'Готово',
    error: 'Помилка',
    cancelled: 'Скасовано',
    skipped: 'Пропущено'
  },
  upload: 'Відвантаження',
  download: 'Завантаження',

  pause: 'Пауза',
  postpone: 'Відкласти',
  resume: 'Продовжити',
  remove: 'Прибрати зі списку'
}
