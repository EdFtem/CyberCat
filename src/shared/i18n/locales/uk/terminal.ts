import type { terminal as en } from '../en/terminal'

export const terminal: typeof en = {
  connecting: (host) => (host ? `Підключення до ${host}…` : 'Підключення до сервера…'),
  sessionEnded: '[сеанс завершено]',
  openFailed: (message) => `Не вдалося відкрити термінал: ${message}`,
  title: 'Термінал',
  hideHint: 'Ctrl+` — сховати',
  close: 'Закрити термінал'
}
