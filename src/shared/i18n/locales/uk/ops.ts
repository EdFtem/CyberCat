import type { ops as en } from '../en/ops'
import { pluralUk } from '../../plural'

const items = (n: number): string => `${n} ${pluralUk(n, 'елемент', 'елементи', 'елементів')}`

export const ops: typeof en = {
  // Name validation
  nameRequired: 'Введіть назву',
  nameInvalid: 'Неприпустима назва',
  nameNoSlashes: 'Назва не може містити / або \\',

  // Opening files
  openFailed: 'Не вдалося відкрити',
  notTextTitle: 'Схоже, це не текстовий файл',
  notTextMessage: (name) => `${name} навряд чи є текстом. Відкрити у редакторі все одно?`,
  externalEditor: 'Зовнішній редактор',

  // New folder / new file
  newFolder: 'Нова тека',
  folderName: 'Назва теки',
  folderPlaceholder: 'нова-тека',
  createFolderFailed: 'Не вдалося створити теку',
  newFile: 'Новий файл',
  fileName: 'Назва файлу',
  createFileFailed: 'Не вдалося створити файл',

  // Rename
  renameTitle: 'Перейменування',
  renameFailed: 'Не вдалося перейменувати',

  // Move to folder
  moveTitle: (name) => `Перемістити ${name}`,
  moveItemsTitle: (n) => `Перемістити ${items(n)}`,
  destinationFolder: 'Тека призначення',
  move: 'Перемістити',
  moveSomeFailed: 'Не все вдалося перемістити',
  moved: 'Переміщено',
  movedMessage: (n, dest) => `${items(n)} у ${dest}`,

  // Delete
  deleted: 'Видалено',
  deleteSomeFailed: 'Не все вдалося видалити',
  deleteTitle: (name) => `Видалити ${name}?`,
  deleteItemsTitle: (n) => `Видалити ${items(n)}?`,
  deleteWithFolders: 'Теки буде видалено разом з усім вмістом. Цю дію неможливо скасувати.',
  deleteIrreversible: 'Цю дію неможливо скасувати.',
  andMore: (n) => `… ще ${n}`,

  // Transfers between panes
  chooseLocalFolder: 'Оберіть локальну теку',
  chooseLocalFolderMessage: 'У локальній панелі відкрито список дисків.',
  transferStartFailed: 'Не вдалося почати передачу',
  moveToServerTitle: (n) => `Перемістити ${items(n)} на сервер?`,
  moveToComputerTitle: (n) => `Перемістити ${items(n)} на комп’ютер?`,
  moveToOtherMessage: (dest) => `Призначення: ${dest}. Файли-джерела буде видалено після успішної передачі кожного з них.`,
  moveStartFailed: 'Не вдалося почати переміщення',

  // Clipboard
  pathCopied: 'Шлях скопійовано',
  pathsCount: (n) => `${n} ${pluralUk(n, 'шлях', 'шляхи', 'шляхів')}`,
  cut: 'Вирізано',
  copied: 'Скопійовано',
  clipboardMessage: (n) => `${items(n)} · Ctrl+V для вставки`,
  pasteAcrossSessions: 'Вставка між різними сесіями поки не підтримується',
  pasteFailed: 'Не вдалося вставити',
  pasteSomeFailed: 'Не все вдалося вставити',

  // Bookmarks
  bookmarkRemoved: 'Закладку прибрано',
  bookmarkAdded: 'Закладку додано',

  // Docker
  dockerLogsFailed: 'Не вдалося відкрити логи',
  dockerShellFailed: 'Не вдалося відкрити shell у контейнері'
}
