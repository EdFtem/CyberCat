import type { settings as en } from '../en/settings'

export const settings: typeof en = {
  title: 'Налаштування',
  language: 'Мова (Language)',
  theme: 'Тема',
  themeDark: 'Темна',
  themeLight: 'Світла',
  externalEditor: 'Зовнішній редактор',
  externalEditorHint:
    'Команда для відкриття файлу. Порожньо = системна програма за замовчуванням. Можна вказати <code>%f</code> для шляху, наприклад <code>code --wait %f</code> або <code>"C:\\Program Files\\Notepad++\\notepad++.exe"</code>.',
  pickProgram: 'Оберіть програму',
  sshAgent: 'SSH-агент',
  agentHintWindows: 'Порожньо = \\\\.\\pipe\\openssh-ssh-agent або SSH_AUTH_SOCK. Для PuTTY вкажіть pageant',
  agentHintPosix: 'Порожньо = SSH_AUTH_SOCK',
  agentPlaceholder: 'авто',
  concurrency: 'Одночасних передач',
  showHidden: 'Показувати приховані файли',
  confirmDelete: 'Підтверджувати видалення',
  customCommands: 'Користувацькі команди на сервері',
  customCommandsHint:
    'По одній на рядок: <code>Назва = команда</code>. Плейсхолдери: <code>%f</code> вибрані файли (повні шляхи), <code>%n</code> лише назви, <code>%d</code> поточна тека. З’являються у контекстному меню серверної панелі.',
  customCommandsPlaceholder:
    'Розмір тек = du -sh %f\nПрава рекурсивно 644 = chmod -R 644 %f\nПерезапустити nginx = sudo systemctl restart nginx && systemctl status nginx --no-pager',
  shortcutsButton: 'Гарячі клавіші'
}
