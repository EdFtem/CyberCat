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

  newS3Description: 'Переглядайте бакети як теки, з відвантаженням і завантаженням, що продовжуються після обриву. Працює з Amazon S3 і сумісними сервісами.',

  kindSsh: 'SSH / SFTP',
  kindS3: 'Бакет S3',
  s3: {
    authKeys: 'Ключ доступу',
    authProfile: 'Профіль AWS',
    accessKeyId: 'Ідентифікатор ключа доступу',
    secret: 'Секретний ключ доступу',
    secretSavedHint: 'Секрет збережено. Введіть новий, щоб замінити.',
    secretAskHint: 'Порожньо = запитати під час підключення',
    saveSecret: 'Зберегти секрет (зашифровано системою)',
    awsProfile: 'Профіль',
    awsProfileHint: 'З ~/.aws/credentials або ~/.aws/config, тож SSO й ролі теж працюють. Для SSO спершу виконайте aws sso login.',
    region: 'Регіон',
    regionHint: 'Порожньо = з профілю або us-east-1. Бакети в інших регіонах знаходяться автоматично.',
    bucket: 'Бакет',
    bucketHint: 'Порожньо = список усіх бакетів',
    endpoint: 'Endpoint',
    endpointHint: 'Лише для S3-сумісних сервісів: MinIO, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, Wasabi. Порожньо = Amazon S3.',
    pathStyle: 'Адресація path-style (потрібна більшості власних серверів)',
    service: 'Amazon S3'
  },

  errors: {
    host: 'Вкажіть адресу сервера',
    username: 'Вкажіть користувача',
    port: 'Порт від 1 до 65535',
    keyPath: 'Оберіть файл ключа',
    accessKeyId: 'Вкажіть ідентифікатор ключа доступу',
    endpoint: 'Вкажіть повну адресу, наприклад https://s3.example.com'
  },

  saveFailed: 'Не вдалося зберегти профіль',
  deleteTitle: (name) => `Видалити профіль ${name}?`,
  deleteMessage: 'Збережений пароль також буде видалено.'
}
