import type { home as en } from '../en/home'

export const home: typeof en = {
  searchPlaceholder: 'Пошук підключень…',
  newConnection: 'Нове підключення',
  newShort: 'Нове',
  importSshConfig: 'Імпорт із ~/.ssh/config',
  emptyTitle: 'Ще немає збережених підключень',
  emptyDescription: 'Заповніть форму праворуч і натисніть «Зберегти», або підключіться одразу без збереження.',
  ungrouped: 'Без групи',
  connectHint: '<kbd>Enter</kbd> у формі підключає · подвійний клік у списку теж',

  auth: {
    password: 'Пароль',
    key: 'Ключ',
    agent: 'SSH-агент'
  },

  profileFallback: 'Профіль',
  editDescription: 'Змініть параметри та підключіться. Зміни зберігаються при підключенні.',
  newDescription: 'Підключіться одразу або збережіть профіль, щоб повертатися до сервера одним кліком.',

  host: 'Хост',
  hostPlaceholder: 'example.com або 10.0.0.5',
  port: 'Порт',
  username: 'Користувач',
  profileName: 'Назва профілю',
  profileNameHint: 'Порожньо = користувач@хост',
  profileNamePlaceholder: 'Прод-сервер',
  authentication: 'Автентифікація',
  password: 'Пароль',
  passwordSavedHint: 'Пароль збережено. Введіть новий, щоб замінити.',
  passwordAskHint: 'Порожньо = запитати при підключенні',
  savePassword: 'Зберігати пароль (зашифровано системою)',
  privateKey: 'Приватний ключ',
  privateKeyHint: 'OpenSSH або PuTTY .ppk. Passphrase буде запитано при підключенні.',
  pickKeyTitle: 'Оберіть приватний ключ',
  agentInfo: 'Ключі беруться з OpenSSH ssh-agent або Pageant. Шлях до агента можна змінити у налаштуваннях.',

  remotePath: 'Стартова тека на сервері',
  localPath: 'Локальна стартова тека',
  homeFolderHint: 'Порожньо = домашня тека',
  pickLocalFolderTitle: 'Локальна тека',
  proxyJump: 'Проміжний хост (ProxyJump)',
  proxyJumpHint:
    'Необов’язково. Формат OpenSSH: [user@]bastion[:port], кілька через кому. Користувач і ключ беруться з ~/.ssh/config, якщо там є запис для цього хоста.',
  group: 'Група',
  groupHint: 'Для групування у списку, напр. «Прод»',
  color: 'Колір мітки',
  noColor: 'Без кольору',

  connect: 'Підключитися',
  saveChanges: 'Зберегти зміни',
  saveProfile: 'Зберегти профіль',

  errors: {
    host: 'Вкажіть адресу сервера',
    username: 'Вкажіть користувача',
    port: 'Порт від 1 до 65535',
    keyPath: 'Оберіть файл ключа'
  },

  saveFailed: 'Не вдалося зберегти профіль',
  deleteTitle: (name) => `Видалити профіль ${name}?`,
  deleteMessage: 'Збережений пароль також буде видалено.'
}
