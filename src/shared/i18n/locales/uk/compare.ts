import type { compare as en } from '../en/compare'
import { pluralUk } from '../../plural'

export const compare: typeof en = {
  title: 'Порівняння та синхронізація тек',
  subtitle: 'Локальна тека ліворуч, сервер праворуч. Напрямок визначає, що робити з відмінностями.',
  summary: (c) =>
    `${c.same} ${pluralUk(c.same, 'однаковий', 'однакові', 'однакових')} · ${c.onlyLocal} лише локально · ${c.onlyRemote} лише на сервері · ${c.different} ${pluralUk(c.different, 'відмінний', 'відмінні', 'відмінних')}`,
  truncated: 'список обрізано',

  localDir: 'Локальна тека',
  remoteDir: 'Тека на сервері',
  run: 'Порівняти',
  byHash: 'Порівнювати вміст за sha256 для файлів однакового розміру (повільніше)',

  scanning: 'Обхід тек…',
  hint: 'Натисніть «Порівняти», щоб побачити відмінності',
  identical: 'Теки однакові',

  colPath: 'Шлях',
  colLocal: 'Локально',
  colRemote: 'На сервері',
  colDiff: 'Відмінність',
  colAction: 'Дія',
  missing: 'немає',

  onlyLocal: 'лише локально',
  onlyRemote: 'лише на сервері',
  different: 'відмінний',
  reasons: { size: 'розмір', mtime: 'дата', hash: 'вміст', type: 'тип' },
  newerLocal: (reason) => `${reason}, новіший локально`,
  newerRemote: (reason) => `${reason}, новіший на сервері`,

  actions: {
    upload: 'на сервер',
    download: 'на комп’ютер',
    deleteLocal: 'видалити локально',
    deleteRemote: 'видалити на сервері',
    skip: 'пропустити'
  },

  dirUpload: 'Локально → сервер',
  dirDownload: 'Сервер → локально',
  dirNewer: 'Новіше перемагає',
  mirror: 'Дзеркало: видаляти у призначенні те, чого немає у джерелі',
  watchAfter: 'Далі стежити за локальною текою і відвантажувати зміни',
  plan: (c) =>
    `План: ${c.upload} ${pluralUk(c.upload, 'файл', 'файли', 'файлів')} на сервер, ${c.download} на комп’ютер` +
    (c.delete > 0 ? `, ${c.delete} видалити` : '') +
    (c.skip > 0 ? `, ${c.skip} пропустити` : ''),

  syncStarted: 'Синхронізацію запущено',
  syncSummary: (c) =>
    [c.upload && `${c.upload} на сервер`, c.download && `${c.download} на комп’ютер`, c.deleted && `${c.deleted} видалено`].filter(Boolean).join(', ')
}
