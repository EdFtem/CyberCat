import type { common as en } from '../en/common'
import { pluralUk } from '../../plural'

export const common: typeof en = {
  ok: 'OK',
  cancel: 'Скасувати',
  close: 'Закрити',
  save: 'Зберегти',
  apply: 'Застосувати',
  confirm: 'Підтвердити',
  continue: 'Продовжити',
  done: 'Готово',
  open: 'Відкрити',
  create: 'Створити',
  delete: 'Видалити',
  rename: 'Перейменувати',
  refresh: 'Оновити',
  retry: 'Повторити',
  browse: 'Обрати',
  copy: 'Копіювати',
  local: 'Локально',
  server: 'Сервер',
  folder: 'тека',
  file: 'файл',
  none: 'немає',
  session: 'сесія',
  unknownError: 'Невідома помилка',
  items: (n) => `${n} ${pluralUk(n, 'елемент', 'елементи', 'елементів')}`,
  files: (n) => `${n} ${pluralUk(n, 'файл', 'файли', 'файлів')}`
}
