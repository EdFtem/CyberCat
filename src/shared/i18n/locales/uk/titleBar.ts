import type { titleBar as en } from '../en/titleBar'
import { pluralUk } from '../../plural'

export const titleBar: typeof en = {
  connections: 'Підключення',
  closeSession: 'Закрити сесію',
  newConnection: 'Нове підключення',
  externalEdits: 'Зовнішнє редагування',
  tunnels: 'Тунелі портів',
  watches: 'Стеження за теками',
  transfers: 'Передачі',
  lightTheme: 'Світла тема',
  darkTheme: 'Темна тема',
  settings: 'Налаштування (Ctrl+,)',

  tunnelsHeading: 'Тунелі портів через SSH',
  tunnelConnections: (n) => `з’єднань: ${n}`,
  openInBrowser: 'Відкрити у браузері',
  closeTunnel: 'Закрити тунель',

  watchesHeading: 'Теки в режимі стеження',
  watchUploaded: (n, time) => `Відвантажено змін: ${n}, остання о ${time}`,
  watchIdle: 'Очікує змін у теці',
  stopWatching: 'Зупинити стеження',

  editsHeading: 'Файли у зовнішньому редакторі',
  noOpenFiles: 'Немає відкритих файлів',
  editUploaded: (n, time) => `Завантажено ${n} ${pluralUk(n, 'раз', 'рази', 'разів')}, останній о ${time}`,
  editIdle: 'Очікує змін у файлі',
  uploadNow: 'Завантажити зараз',
  finishEditing: 'Завершити редагування'
}
