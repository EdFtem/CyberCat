import type { dockerInspect as en } from '../en/dockerInspect'

export const dockerInspect: typeof en = {
  structured: 'Структуровано',
  json: 'JSON',
  none: 'Немає',

  general: 'Загальне',
  state: 'Стан',
  exitCode: (code) => `код виходу ${code}`,
  started: 'Запущено',
  created: 'Створено',
  command: 'Команда',
  restarts: 'Рестарти',
  restartsValue: (count, policy) => `${count} · політика ${policy}`,
  workingDir: 'Робоча тека',
  user: 'Користувач',

  ports: 'Порти',
  notPublished: 'не опубліковано',

  mounts: 'Монтування',
  openOnHostTitle: 'Відкрити теку на хості у панелі',
  openOnHost: 'На хості',

  networks: 'Мережі',
  gateway: (ip) => `шлюз ${ip}`,

  environment: 'Середовище',
  showSecrets: 'показувати секрети',

  labels: 'Мітки'
}
