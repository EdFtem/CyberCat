import type { docker as en } from '../en/docker'
import { pluralUk } from '../../plural'

export const docker: typeof en = {
  // Header
  backToFiles: 'До файлів (Ctrl+Shift+D)',
  files: 'Файли',
  tabContainers: 'Контейнери',
  tabImages: 'Образи',
  tabVolumes: 'Томи',
  filterPlaceholder: 'Фільтр…',
  autoRefreshOn: 'Автооновлення кожні 5 с увімкнено',
  autoRefreshOff: 'Автооновлення вимкнено',

  // Docker unavailable
  notFound: 'Docker не знайдено',
  notAccessible: 'Docker є, але недоступний',
  enableSudo: 'Увімкнути sudo-режим',
  checkAgain: 'Перевірити знову',

  // Containers
  noContainers: 'Контейнерів немає',
  noContainersHint: 'Запустіть щось через docker run або compose up, і воно з’явиться тут.',
  standalone: 'Окремі контейнери',
  containers: (n) => `${n} ${pluralUk(n, 'контейнер', 'контейнери', 'контейнерів')}`,
  openFile: (path) => `Відкрити ${path}`,
  runningOf: (running, total) => `${running} запущено з ${total}`,
  reclaimable: (size) => `(можна звільнити ${size})`,
  portHint: 'Клік по порту відкриває тунель у браузері',
  restarts: (n) => `рестартів ${n}`,
  openPortTitle: (addr) => `Відкрити http://localhost → ${addr} через тунель`,
  portNotPublished: 'Порт не опубліковано',
  start: 'Запустити',
  stop: 'Зупинити',
  restart: 'Перезапустити',
  pause: 'Пауза',
  unpause: 'Відновити',
  followLogs: 'Логи наживо',
  shell: 'Shell у контейнері',
  details: 'Деталі (inspect)',
  removeContainer: 'Видалити контейнер',
  remove: 'Видалити',
  removeContainerTitle: (name) => `Видалити контейнер ${name}?`,
  removeRunningMessage: 'Контейнер запущено, його буде зупинено примусово. Дані в іменованих томах залишаться.',
  removeStoppedMessage: 'Дані в іменованих томах залишаться.',
  tunnelOpened: 'Тунель відкрито',
  tunnelOpenedMessage: (localPort, host, hostPort) =>
    `localhost:${localPort} → ${host}:${hostPort} на сервері. Зупинити можна у меню тунелів у заголовку.`,
  tunnelFailed: 'Не вдалося відкрити тунель',
  composeConfirmTitle: (action, project) => `compose ${action} для ${project}?`,
  composeDownMessage: 'Контейнери проєкту буде зупинено й видалено. Томи залишаться.',

  // Images and volumes
  inUse: 'використовується',
  unused: 'не використовується',
  dangling: 'без тегу',
  prune: 'Прибрати',
  images: (n) => `${n} ${pluralUk(n, 'образ', 'образи', 'образів')}`,
  danglingCount: (n) => `${n} без тегу`,
  pruneImagesTitle: 'Прибрати образи без тегу?',
  pruneImagesMessage: (n) =>
    `Буде видалено ${n} ${pluralUk(n, 'образ', 'образи', 'образів')} без тегу, які не використовуються контейнерами.`,
  pruneDangling: 'Прибрати без тегу',
  pullImage: 'Оновити образ (pull)',
  imageInUse: 'Образ використовується контейнером',
  removeImage: 'Видалити образ',
  removeImageTitle: (name) => `Видалити образ ${name}?`,
  removeImageMessage: (size) => `Звільниться близько ${size}.`,
  noImages: 'Образів немає',

  volumes: (n) => `${n} ${pluralUk(n, 'том', 'томи', 'томів')}`,
  unusedCount: (n) => `${n} не використовується`,
  pruneVolumesTitle: 'Прибрати невикористані томи?',
  pruneVolumesMessage: (n) =>
    `Буде безповоротно видалено ${n} ${pluralUk(n, 'том', 'томи', 'томів')} разом із даними. Переконайтесь, що вони справді не потрібні.`,
  pruneUnused: 'Прибрати невикористані',
  volumeInUse: 'Том використовується контейнером',
  removeVolume: 'Видалити том',
  removeVolumeTitle: (name) => `Видалити том ${name}?`,
  removeVolumeMessage: 'Усі дані тому буде безповоротно втрачено.',
  noVolumes: 'Томів немає'
}
