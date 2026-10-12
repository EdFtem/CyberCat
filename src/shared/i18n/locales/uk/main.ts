import type { main as en } from '../en/main'

export const main: typeof en = {
  app: {
    pickFile: 'Оберіть файл',
    pickFolder: 'Оберіть теку',
    httpOnly: 'Дозволено лише http(s) посилання',
    cancelled: 'Скасовано',
    quitting: 'Застосунок закривається'
  },

  exec: {
    failed: (cmd) => `${cmd} не вдався`,
    exitCode: (cmd, code) => `${cmd} завершився з кодом ${code}`,
    timeout: (seconds) => `Команда не завершилась за ${seconds} с`,
    shellRequired: 'Потрібен доступ до shell на сервері'
  },

  session: {
    notConnected: 'Сесію не підключено',
    notFound: 'Сесію не знайдено',
    closed: 'Сесію закрито',
    disconnected: 'Сесію відключено',
    profileNotFound: 'Профіль не знайдено',
    noProfile: 'Не вказано профіль підключення',
    closedByServer: 'З’єднання закрито сервером',
    reconnecting: (attempt, max) => `З’єднання втрачено, спроба ${attempt} з ${max}`,
    reconnectFailed: 'Не вдалося відновити з’єднання',
    connectionLost: 'З’єднання втрачено'
  },

  ssh: {
    connectCancelled: 'Підключення скасовано',
    keyReadFailed: (path, error) => `Не вдалося прочитати ключ ${path}: ${error}`,
    keyDecryptFailed: (error) => `Не вдалося розшифрувати ключ: ${error}`,
    noKeyFile: 'Не вказано файл приватного ключа',
    emptyProxyJump: 'Порожній ProxyJump',
    jumpTunnelFailed: (host, port, error) => `тунель до ${host}:${port} не вдався: ${error}`,
    jumpHostError: (host, error) => `Проміжний хост ${host}: ${error}`,
    authFailed: 'Автентифікація не вдалася: невірний пароль, ключ або ім’я користувача',
    connectionRefused: 'Сервер відхилив з’єднання. Перевірте адресу та порт',
    hostNotFound: 'Не вдалося знайти хост. Перевірте адресу',
    timedOut: 'Час очікування вичерпано. Сервер не відповідає',
    hostKeyRejected: 'Ключ сервера відхилено',
    agentUnavailable: 'SSH-агент недоступний. Запустіть ssh-agent або Pageant'
  },

  sudo: {
    needsShell: 'sudo-режим потребує доступу до shell на сервері',
    notInstalled: 'На сервері немає sudo',
    notAllowed: (user) => `Користувачу ${user} не дозволено sudo`,
    requiresTty: 'sudoers вимагає tty (requiretty), sudo-режим недоступний',
    passwordPrompt: (user, host) => `Пароль sudo для ${user}@${host}`,
    wrongPasswordRetry: 'Невірний пароль sudo, спробуйте ще раз',
    wrongPassword: 'Невірний пароль sudo',
    cancelled: 'sudo скасовано',
    commandsOnlyTitle: 'sudo увімкнено лише для команд',
    commandsOnlyMessage:
      'На сервері не знайдено sftp-server, тому файлові операції виконуються від вашого користувача. Docker, термінал і команди працюють від root.'
  },

  docker: {
    notFound: 'На сервері не знайдено docker або podman',
    daemonDenied: (user) =>
      `Немає доступу до Docker daemon для користувача ${user}. Увімкніть sudo-режим або додайте користувача до групи docker`,
    daemonNotRunning: 'Docker daemon не запущено',
    unavailable: 'Docker недоступний'
  },

  fs: {
    alreadyExists: (path) => `Файл або тека вже існує: ${path}`,
    notAFolder: (path) => `Шлях існує, але це не тека: ${path}`,
    isFolder: 'Це тека, а не файл',
    unexpectedEof: 'Несподіваний кінець файлу під час читання',
    copyNeedsShell: 'Копіювання на сервері потребує shell'
  },

  transfer: {
    destUnavailable: 'Тека призначення недоступна',
    addFailed: (name) => `Не вдалося додати ${name}`,
    deleteSourceFailed: (name) => `Не вдалося видалити джерело ${name}`,
    waitingForReconnect: 'Очікування відновлення з’єднання',
    reconnected: 'З’єднання відновлено',
    resumed: (count) => `Передачі продовжено: ${count}`,
    remoteShrank: 'Файл на сервері став коротшим під час передачі',
    localShrank: 'Локальний файл став коротшим під час передачі'
  },

  editor: {
    launchFailed: 'Не вдалося запустити редактор',
    tooLarge: 'Файл завеликий для редагування',
    uploadFailed: (name) => `Не вдалося завантажити ${name}`
  },

  search: {
    nothingToFind: 'Вкажіть назву або текст для пошуку',
    noFolder: 'Не вказано теку для пошуку',
    sftpContentWarning: 'Shell недоступний, пошук за вмістом виконано через SFTP і може бути повільним',
    s3ContentWarning: 'Пошук за вмістом завантажує кожен відповідний об’єкт із бакета й може бути повільним'
  },

  tail: {
    exitedImmediately: 'Команда завершилась одразу після запуску',
    truncated: '[файл обрізано або замінено]'
  },

  sync: {
    watchFailed: (error) => `Не вдалося стежити за текою: ${error}`,
    watchStarted: 'Стеження увімкнено'
  },

  tunnel: {
    forwardingDenied:
      'Сервер забороняє перенаправлення портів (AllowTcpForwarding no у sshd_config) або порт недоступний',
    failed: (host, port) => `Тунель до ${host}:${port} не працює`
  },

  s3: {
    notSupported: 'Недоступно для підключень S3',
    noPermissions: 'Об’єкти S3 не мають прав доступу до файлів',
    noAccessKey: 'Вкажіть ідентифікатор ключа доступу в налаштуваннях підключення',
    secretPrompt: (keyId) => `Секретний ключ для ${keyId}`,
    wrongSecretRetry: 'Невірний ідентифікатор ключа або секретний ключ, спробуйте ще раз',
    authFailed: 'Невірний ідентифікатор ключа або секретний ключ',
    expiredToken: 'Термін дії облікових даних минув. Оновіть їх і підключіться знову',
    ssoExpired: (profile) => `Сесія SSO профілю ${profile} завершилася. Виконайте aws sso login --profile ${profile} і підключіться знову`,
    profileFailed: (profile, error) => `Профіль AWS ${profile}: ${error}`,
    accessDenied: (what) => `Доступ заборонено: ${what}`,
    cannotListBuckets: 'Ці облікові дані не можуть переглядати список бакетів. Вкажіть бакет у налаштуваннях підключення або введіть /назва-бакета в рядку шляху',
    noSuchBucket: (bucket) => `Бакета ${bucket} не існує`,
    bucketNotEmpty: (bucket) => `Бакет ${bucket} не порожній. Спершу видаліть його вміст`,
    notFound: (path) => `Немає такого файлу або теки: ${path}`,
    unreachable: (host) => `Не вдалося з’єднатися з ${host}. Перевірте адресу й мережу`,
    changedDuringTransfer: 'Об’єкт на сервері змінився під час передачі',
    copyTooLarge: (name) => `${name} більший за 5 ГБ, а S3 не копіює такі об’єкти за один крок. Завантажте його й відвантажте знову`,
    awsLabel: (region) => `Amazon S3 · ${region}`
  }
}
