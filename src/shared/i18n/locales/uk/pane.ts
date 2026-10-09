import type { pane as en } from '../en/pane'
import { pluralUk } from '../../plural'

const items = (n: number): string => `${n} ${pluralUk(n, 'елемент', 'елементи', 'елементів')}`

export const pane: typeof en = {
  thisPc: 'Цей ПК',

  // Header
  localComputer: 'Локальний комп’ютер',
  sudoFilesTitle: 'Файли й команди виконуються від root',
  sudoCommandsTitle: 'Команди від root, файлові операції від вашого користувача: на сервері немає sftp-server',
  sudoCommandsBadge: 'root: команди',
  back: 'Назад',
  forward: 'Вперед',
  up: 'Вгору (Backspace)',
  homeFolder: 'Домашня тека',
  bookmarks: 'Закладки',
  refreshHint: 'Оновити (Ctrl+R)',

  // Action bar
  newFolderHint: 'Нова тека (F7)',
  newFileHint: 'Новий файл (Ctrl+Shift+N)',
  downloadSelectedHint: 'Завантажити вибране на комп’ютер (F5)',
  uploadSelectedHint: 'Відвантажити вибране на сервер (F5)',
  renameHint: 'Перейменувати (F2)',
  deleteHint: 'Видалити (Del)',
  permissions: 'Права доступу',
  sudoOff: 'Вимкнути sudo-режим',
  sudoOn: 'sudo-режим: операції з правами root',
  compareWithLocal: 'Порівняти з локальною текою',
  terminalHere: 'Термінал у цій теці',
  searchHint: 'Пошук (Ctrl+Shift+F)',
  hideHiddenHint: 'Сховати приховані (Ctrl+H)',
  showHiddenHint: 'Показати приховані (Ctrl+H)',
  filterHint: 'Фільтр (Ctrl+F)',
  filterPlaceholder: 'Фільтр за назвою…',
  closeFilter: 'Закрити фільтр',

  // Footer
  itemsOf: (n, total) => `${items(n)} з ${total}`,
  itemsHidden: (n, hidden) => `${items(n)} · приховано ${hidden}`,
  selectedCount: (n) => `Вибрано ${n}`,
  diskFree: (free) => `Вільно ${free}`,
  diskFreeOf: (free, total) => `Вільно ${free} з ${total}`,

  // Column headers
  colName: 'Ім’я',
  colSize: 'Розмір',
  colModified: 'Змінено',
  colPermissions: 'Права',
  colOwner: 'Власник',

  // Empty states
  openFolderFailed: 'Не вдалося відкрити теку',
  noMatches: 'Нічого не знайдено',
  folderEmpty: 'Тека порожня',
  filterNoMatches: (filter) => `За фільтром «${filter}» немає збігів`,
  hiddenFilesOff: 'Приховані файли вимкнено (Ctrl+H)',

  // Bookmarks menu
  removeBookmark: 'Прибрати поточну теку із закладок',
  addBookmark: 'Додати поточну теку в закладки',

  // Context menu
  newFolder: 'Нова тека',
  newFile: 'Новий файл',
  paste: 'Вставити',
  searchHere: 'Пошук у цій теці…',
  compareWithLocalMenu: 'Порівняти з локальною текою…',
  showHidden: 'Показувати приховані',
  openTerminalHere: 'Відкрити термінал тут',
  showInFileManager: 'Показати у Провіднику',
  copyFolderPath: 'Копіювати шлях теки',
  openInEditor: 'Відкрити у редакторі',
  editExternal: 'Редагувати у зовнішньому редакторі',
  openWithSystem: 'Відкрити системною програмою',
  followLog: 'Стежити за логом',
  downloadToComputer: (n) => (n > 1 ? `Завантажити ${items(n)} на комп’ютер` : 'Завантажити на комп’ютер'),
  uploadToServer: (n) => (n > 1 ? `Відвантажити ${items(n)} на сервер` : 'Відвантажити на сервер'),
  moveToComputer: 'Перемістити на комп’ютер',
  moveToServer: 'Перемістити на сервер',
  moveToFolder: 'Перемістити в теку…',
  cut: 'Вирізати',
  batchRename: 'Масове перейменування…',
  permissionsMenu: 'Права доступу…',
  copyPath: 'Копіювати шлях',
  properties: 'Властивості'
}
