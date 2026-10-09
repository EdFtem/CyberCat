# CyberCat

[![CI](https://github.com/EdFtem/CyberCat/actions/workflows/ci.yml/badge.svg)](https://github.com/EdFtem/CyberCat/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-22d3ee.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

Graphical SSH/SFTP file manager: dual-pane browser, resumable transfer queue, Monaco editor with encoding and EOL preservation, external editor auto-upload and a built-in terminal on the same SSH session. Built with Electron, React, TypeScript, Tailwind, ssh2, Monaco and xterm.js.

![CyberCat connection manager](docs/screenshot-home.png)

**English summary.** CyberCat is a WinSCP-style client for people who live in SSH all day. Connection profiles support passwords, OpenSSH and PuTTY keys and SSH agents, with passwords stored through the OS keychain and strict host key verification. Transfers run in a queue with pause, cancel, retry and resume from the last committed byte, and they survive reconnects. Files open in Monaco with the original encoding and line endings preserved, saves are atomic and conflicts with server-side edits are detected. Hosts import from `~/.ssh/config` including ProxyJump chains, logs can be followed live with `tail -F`, and files are searchable by name and content. The UI is currently in Ukrainian; localization is on the roadmap. Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

Графічний файловий менеджер для роботи з серверами по SSH/SFTP: двопанельний браузер, редактор з підсвічуванням, черга передач із відновленням, вбудований термінал.

## Можливості

- **Профілі підключень**: пароль, приватний ключ (OpenSSH, PuTTY ppk, із passphrase), SSH-агент (OpenSSH agent, Pageant). Паролі зберігаються зашифрованими через системне сховище.
- **Перевірка ключа сервера**: запам'ятовування при першому підключенні, жорстке попередження при зміні відбитка.
- **Двопанельний браузер** локально і на сервері з вкладками для кількох серверів, хлібними крихтами, історією, фільтром, сортуванням, показом прав і власника, символічних посилань, вільного місця.
- **Передачі**: перетягування між панелями та з Провідника, черга з паузою, скасуванням, повтором, відновленням перерваних передач, політиками перезапису, збереженням mtime, автоматичним продовженням після перепідключення.
- **Вбудований редактор** на Monaco: підсвічування, збереження кодування (UTF-8, UTF-8 BOM, Windows-1251) і типу переносу рядка, атомарний запис, виявлення конфліктів за часом зміни.
- **Зовнішній редактор**: файл завантажується у тимчасову теку, відкривається у вашій програмі та автоматично заливається при кожному збереженні.
- **Операції**: створення тек і файлів, перейменування, переміщення, рекурсивне видалення, chmod із рекурсією, властивості, копіювання шляху.
- **Вбудований термінал** на xterm.js у тій самій SSH-сесії, відкривається у поточній теці.
- **Імпорт ~/.ssh/config**: хости, користувачі, порти, ключі та ProxyJump підхоплюються одним кліком, з підтримкою Include і шаблонів.
- **ProxyJump**: підключення через один або кілька проміжних хостів, дані для bastion беруться з ssh config.
- **Живий перегляд логів**: tail -F у pty з підсвіткою рівнів, фільтром, паузою й автопрокруткою; без shell працює через опитування SFTP.
- **Пошук на сервері**: за назвою через find і за вмістом через grep, з переходом до файлу у панелі або в редактор.
- **Автоперепідключення** з keepalive, стійка черга передач.

![Editor](docs/screenshot-editor.png)

![Live log view](docs/screenshot-logview.png)

## Запуск

```bash
npm install
npm run dev        # розробка з гарячим перезавантаженням
npm run build      # збірка у out/
npm start          # запуск зібраного застосунку
npm run dist       # пакування (electron-builder, Windows)
```

Якщо ви запускаєте з терміналу VS Code і вікно не з'являється, зніміть змінну середовища `ELECTRON_RUN_AS_NODE`.

## Гарячі клавіші

| Клавіша | Дія |
|---|---|
| Enter / Backspace | Відкрити / вгору |
| F2 | Перейменувати |
| F3, F4 | Відкрити у редакторі |
| Shift+F4 | Зовнішній редактор |
| F5 | Копіювати на іншу панель |
| F6 | Перемістити |
| F7 | Нова тека |
| F8, Del | Видалити |
| Ctrl+L | Редагувати шлях |
| Ctrl+F | Фільтр |
| Ctrl+Shift+F | Пошук у поточній теці |
| Ctrl+H | Приховані файли |
| Ctrl+R | Оновити |
| Ctrl+Shift+N | Новий файл |
| Ctrl+Shift+C | Копіювати шлях |
| Ctrl+` | Термінал |
| Ctrl+E | Редактор / файли |
| Ctrl+Tab | Наступна вкладка |
| Ctrl+, | Налаштування |
| Tab | Інша панель |

## Тести

Потрібен тестовий SSH-сервер у Docker:

```bash
docker run -d --name cybercat-sshd -p 2222:2222 -e PUID=1000 -e PGID=1000 \
  -e PASSWORD_ACCESS=true -e USER_NAME=cat -e USER_PASSWORD=catpass \
  lscr.io/linuxserver/openssh-server:latest

npm run test:e2e     # бекенд: SFTP, редактор, передачі, shell
npm run test:ui      # знімки екрана у out/shots/
```

## Структура

```
src/main        Electron main: SSH-сесії (ssh2), SFTP/локальна ФС, передачі, редактор, термінал, IPC
src/preload     Міст window.api (contextBridge)
src/renderer    React + Tailwind UI: панелі, діалоги, редактор Monaco, термінал xterm
src/shared      Спільні типи та контракт API
tests           e2e-тест бекенду та smoke-тест UI
```

## План розвитку

- sudo-режим для редагування системних файлів
- Порівняння і синхронізація тек
- Масове перейменування, користувацькі команди, закладки
- Інсталятор, автооновлення, локалізація інтерфейсу

## Відомі обмеження

- Вбудований редактор відкриває файли до 8 МБ, більші відкривайте у зовнішньому редакторі.
- Атомарне збереження створює новий inode, тому жорсткі посилання на файл розриваються.
- Передача сервер-сервер поки не підтримується.

## Внесок і ліцензія

Issues та pull requests вітаються, деталі у [CONTRIBUTING.md](CONTRIBUTING.md). Про вразливості повідомляйте приватно, див. [SECURITY.md](SECURITY.md).

Код поширюється за ліцензією [MIT](LICENSE).
