import type { store as en } from '../en/store'

export const store: typeof en = {
  connectFailed: 'Не вдалося підключитися',
  closeTabDirtyTitle: 'Закрити з незбереженими змінами?',
  closeTabDirtyMessage: 'У цій сесії є незбережені файли. Зміни буде втрачено.',
  closeWithoutSaving: 'Закрити без збереження',
  fileTooLarge: 'Файл завеликий',
  fileTooLargeMessage: 'Показано лише перші 8 МБ. Збереження вимкнено, скористайтеся зовнішнім редактором.',
  openFileFailed: 'Не вдалося відкрити файл',
  openLogFailed: 'Не вдалося відкрити лог',
  saveDisabled: 'Збереження вимкнено',
  saveDisabledMessage: 'Файл було відкрито частково.',
  changedExternallyTitle: 'Файл змінено ззовні',
  changedExternallyMessage: (name) => `${name} було змінено після відкриття. Перезаписати чужі зміни?`,
  overwrite: 'Перезаписати',
  saveFailed: 'Не вдалося зберегти',
  closeDocDirtyTitle: 'Закрити без збереження?',
  closeDocDirtyMessage: (name) => `Файл ${name} має незбережені зміни.`,
  sudoOn: 'sudo-режим увімкнено',
  sudoOff: 'sudo-режим вимкнено',
  sudoOnMessage: 'Операції на сервері виконуються з правами root. Будьте обережні.'
}
