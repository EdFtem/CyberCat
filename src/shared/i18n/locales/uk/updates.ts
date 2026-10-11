import type { updates as en } from '../en/updates'

export const updates: typeof en = {
  title: 'Оновлення',
  version: (v) => `CyberCat ${v}`,
  autoCheck: 'Автоматично перевіряти оновлення',
  checkNow: 'Перевірити зараз',

  checking: 'Перевірка оновлень…',
  upToDate: 'У вас найновіша версія.',
  available: (v) => `Доступна версія ${v}.`,
  downloading: (v, pct) => `Завантаження версії ${v}… ${pct}%`,
  downloaded: (v) => `Версія ${v} готова до встановлення.`,
  error: (message) => `Не вдалося перевірити оновлення: ${message}`,
  unsupported: 'Оновлення працюють у встановлених збірках. Це збірка для розробки.',
  manualHint: 'Ця збірка не може оновитися сама. Завантажте нову версію з GitHub і встановіть поверх поточної.',

  download: 'Завантажити',
  whatsNew: 'Що нового',
  restart: 'Перезапустити й оновити',

  pillAvailable: (v) => `Оновлення ${v}`,
  pillDownloading: (pct) => `Оновлення… ${pct}%`,
  pillReady: 'Перезапустити для оновлення',

  confirmTitle: (v) => `Встановити CyberCat ${v}?`,
  confirmMessage: 'CyberCat закриється, встановить оновлення й запуститься знову. Відкриті сесії буде закрито, а поточні передачі скасовано.',

  toastReadyTitle: (v) => `CyberCat ${v} готовий до встановлення`,
  toastReadyMessage: 'Перезапустіть кнопкою в заголовку, або оновлення встановиться під час наступного виходу.',
  toastAvailableTitle: (v) => `Доступний CyberCat ${v}`,
  toastAvailableMessage: 'Завантажте його кнопкою в заголовку.'
}
