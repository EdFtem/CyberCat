import { getMessages, type Messages } from '@shared/i18n'
import { settings } from './store/settings'

/** Messages in the language chosen in Settings, for errors and toasts created in the main process */
export function tr(): Messages {
  return getMessages(settings.get().language)
}
