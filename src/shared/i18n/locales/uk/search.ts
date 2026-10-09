import type { search as en } from '../en/search'
import { pluralUk } from '../../plural'

export const search: typeof en = {
  titleLocal: 'Пошук на комп’ютері',
  titleRemote: 'Пошук на сервері',
  matches: (n) => `${n} ${pluralUk(n, 'збіг', 'збіги', 'збігів')}`,
  truncated: 'показано перші, уточніть запит',
  viaSftp: 'через SFTP',
  run: 'Шукати',

  name: 'Назва файлу',
  nameHint: 'Підрядок або шаблон з * і ?',
  content: 'Текст у вмісті',
  contentHintLocal: 'Файли до 4 МБ',
  contentHintRemote: 'Через grep, якщо є shell',
  root: 'Де шукати',
  caseSensitive: 'Враховувати регістр',

  nothingFound: 'Нічого не знайдено',
  hint: 'Введіть назву або текст і натисніть Enter',

  reveal: 'Показати у панелі',
  goTo: 'Перейти',
  openInEditor: 'Відкрити у редакторі'
}
