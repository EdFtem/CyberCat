/** App updates from GitHub Releases: title bar button, settings section, toasts */
export const updates = {
  title: 'Updates',
  version: (v: string) => `CyberCat ${v}`,
  autoCheck: 'Check for updates automatically',
  checkNow: 'Check now',

  checking: 'Checking for updates…',
  upToDate: 'You have the latest version.',
  available: (v: string) => `Version ${v} is available.`,
  downloading: (v: string, pct: number) => `Downloading version ${v}… ${pct}%`,
  downloaded: (v: string) => `Version ${v} is ready to install.`,
  error: (message: string) => `Could not check for updates: ${message}`,
  unsupported: 'Updates work in installed builds. This is a development build.',
  manualHint: 'This build cannot update itself. Download the new version from GitHub and install it over the current one.',

  download: 'Download',
  whatsNew: 'What’s new',
  restart: 'Restart and update',

  pillAvailable: (v: string) => `Update ${v}`,
  pillDownloading: (pct: number) => `Updating… ${pct}%`,
  pillReady: 'Restart to update',

  confirmTitle: (v: string) => `Install CyberCat ${v}?`,
  confirmMessage: 'CyberCat will close, install the update and start again. Open sessions are closed and running transfers are cancelled.',

  toastReadyTitle: (v: string) => `CyberCat ${v} is ready to install`,
  toastReadyMessage: 'Restart from the button in the title bar, or it installs the next time you quit.',
  toastAvailableTitle: (v: string) => `CyberCat ${v} is available`,
  toastAvailableMessage: 'Download it from the button in the title bar.'
}
