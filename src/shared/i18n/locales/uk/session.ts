import type { session as en } from '../en/session'
import { pluralUk } from '../../plural'

export const session: typeof en = {
  connectFailed: 'Не вдалося підключитися',
  connecting: 'Підключення…',
  reconnecting: 'Відновлення з’єднання…',
  connectionLost: 'З’єднання втрачено',
  reconnect: 'Підключитися знову',

  sftpOnly: 'лише SFTP',
  selection: (pane, n, size) =>
    `${pane === 'local' ? 'Локально' : 'Сервер'}: вибрано ${n} ${pluralUk(n, 'елемент', 'елементи', 'елементів')}${size ? `, ${size}` : ''}`,
  editorFiles: (n) => `${n} ${pluralUk(n, 'файл', 'файли', 'файлів')} у редакторі`,
  editorTitle: 'Редактор (Ctrl+E)',
  terminalTitle: 'Термінал (Ctrl+`)'
}
