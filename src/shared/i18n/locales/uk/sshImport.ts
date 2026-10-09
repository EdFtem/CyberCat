import type { sshImport as en } from '../en/sshImport'
import { pluralUk } from '../../plural'

export const sshImport: typeof en = {
  title: 'Імпорт із ~/.ssh/config',
  subtitle: 'Профілі з ключами, портами й ProxyJump із вашого OpenSSH-конфігу',
  selectAll: 'Вибрати всі',
  deselectAll: 'Зняти всі',
  importButton: (n) => (n ? `Імпортувати (${n})` : 'Імпортувати'),
  noHosts:
    'У ~/.ssh/config немає блоків Host з конкретними іменами. Блоки з шаблонами * і ? пропускаються, але їхні опції застосовуються до імпортованих хостів.',
  profileExists: 'вже є профіль',
  defaultKeyNote: 'Хости без IdentityFile отримають перший знайдений стандартний ключ (id_ed25519, id_ecdsa, id_rsa) або автентифікацію паролем.',
  doneTitle: 'Імпорт завершено',
  doneMessage: (n, group) => `${n} ${pluralUk(n, 'профіль', 'профілі', 'профілів')} у групі «${group}»`
}
