import { useApp } from '@/store/app'
import { tr } from './i18n'

/** Restart-and-install confirmation shared by the title bar button and Settings */
export function confirmInstallUpdate(): void {
  const { update, openDialog } = useApp.getState()
  if (!update?.version || update.state !== 'downloaded') return
  const t = tr().updates
  openDialog({
    kind: 'confirm',
    title: t.confirmTitle(update.version),
    message: t.confirmMessage,
    okLabel: t.restart,
    onConfirm: () => window.api.update.install()
  })
}
