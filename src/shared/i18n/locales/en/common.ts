import { pluralEn } from '../../plural'

/** Words reused across many screens */
export const common = {
  ok: 'OK',
  cancel: 'Cancel',
  close: 'Close',
  save: 'Save',
  apply: 'Apply',
  confirm: 'Confirm',
  continue: 'Continue',
  done: 'Done',
  open: 'Open',
  create: 'Create',
  delete: 'Delete',
  rename: 'Rename',
  refresh: 'Refresh',
  retry: 'Retry',
  browse: 'Browse',
  copy: 'Copy',
  local: 'Local',
  server: 'Server',
  folder: 'folder',
  file: 'file',
  none: 'none',
  /** Fallback label when a session name is unknown */
  session: 'session',
  unknownError: 'Unknown error',
  items: (n: number) => `${n} ${pluralEn(n, 'item', 'items')}`,
  files: (n: number) => `${n} ${pluralEn(n, 'file', 'files')}`
}
