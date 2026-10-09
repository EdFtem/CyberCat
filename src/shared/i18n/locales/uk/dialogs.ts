import type { dialogs as en } from '../en/dialogs'
import { pluralUk } from '../../plural'

export const dialogs: typeof en = {
  chmodTitle: 'Права доступу',
  chmodMixed: 'права відрізняються',
  chmodRead: 'Читання',
  chmodWrite: 'Запис',
  chmodExecute: 'Виконання',
  chmodOwner: 'Власник',
  chmodGroup: 'Група',
  chmodOthers: 'Інші',
  chmodOctalHint: 'Напр. 644',
  chmodRecursive: 'Застосувати рекурсивно до вмісту тек',
  chmodDone: 'Права змінено',
  chmodDoneMessage: (mode, n) => `${mode} для ${n} ${pluralUk(n, 'елемента', 'елементів', 'елементів')}`,
  chmodFailed: 'Не вдалося змінити права',

  propPath: 'Шлях',
  propType: 'Тип',
  propDrive: 'Диск',
  propSymlink: 'Символічне посилання',
  propSymlinkToFolder: 'Символічне посилання на теку',
  propFolder: 'Тека',
  propFile: 'Файл',
  propTarget: 'Ціль',
  propSize: 'Розмір',
  propBytes: (n) => `${n} Б`,
  propModified: 'Змінено',
  propPermissions: 'Права',
  propOwner: 'Власник',
  propLocation: 'Розташування',
  propLocalComputer: 'Локальний комп’ютер',
  propServer: 'Сервер',

  aboutTitle: 'Про CyberCat',
  aboutDescription: 'Графічний SSH/SFTP файловий менеджер. Electron, React, ssh2, Monaco, xterm.js.'
}
