import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from './broadcast'
import { settings } from './store/settings'
import type { UpdateStatus } from '@shared/types'

/** Releases are published on GitHub (the publish section of electron-builder.yml names the same repository) */
const OWNER = 'EdFtem'
const REPO = 'CyberCat'
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`
const FIRST_CHECK_DELAY = 20_000
const CHECK_INTERVAL = 6 * 60 * 60 * 1000

/**
 * Whether this build can replace itself. Windows (NSIS install) and Linux AppImage can.
 * macOS needs a Developer ID signature for Squirrel.Mac, and portable or deb builds cannot
 * swap their own files, so those get a download link to the release page instead.
 */
function canInstall(): boolean {
  if (process.platform === 'win32') return !process.env.PORTABLE_EXECUTABLE_DIR
  if (process.platform === 'linux') return !!process.env.APPIMAGE
  return false
}

/** CYBERCAT_UPDATE_FEED points the updater at a generic HTTP feed, for testing without GitHub */
const testFeed = process.env.CYBERCAT_UPDATE_FEED

let status: UpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion(),
  canInstall: canInstall(),
  releaseUrl: `${RELEASES_URL}/latest`
}
/** The running check was started by the user, so "up to date" and errors are worth showing */
let manualCheck = false

function set(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch }
  broadcast('update:status', status)
}

/** No release published yet, or the newest one has no update metadata: nothing to update to */
function isNothingPublished(message: string): boolean {
  return /No published versions|latest(-mac|-linux)?\.yml|HttpError: 404|status code 404/i.test(message)
}

export const updater = {
  init(): void {
    if (!app.isPackaged && !testFeed) {
      status = { ...status, state: 'unsupported' }
      return
    }
    // Set the feed in code so checks work in every build, even one without app-update.yml (an unpacked --dir build)
    if (testFeed) {
      autoUpdater.forceDevUpdateConfig = !app.isPackaged
      autoUpdater.setFeedURL({ provider: 'generic', url: testFeed })
    } else {
      autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO })
    }
    autoUpdater.logger = {
      info: (m: unknown) => console.log('[updater]', m),
      warn: (m: unknown) => console.warn('[updater]', m),
      error: (m: unknown) => console.error('[updater]', m),
      debug: () => {}
    }
    autoUpdater.autoDownload = status.canInstall
    autoUpdater.autoInstallOnAppQuit = status.canInstall
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: undefined }))
    autoUpdater.on('update-available', (info) =>
      set({
        state: status.canInstall ? 'downloading' : 'available',
        version: info.version,
        percent: 0,
        releaseUrl: `${RELEASES_URL}/tag/v${info.version}`
      })
    )
    autoUpdater.on('update-not-available', () => set({ state: 'up-to-date', version: undefined, percent: undefined }))
    autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.floor(p.percent) }))
    autoUpdater.on('update-downloaded', (info) => set({ state: 'downloaded', version: info.version, percent: 100 }))
    autoUpdater.on('error', (e) => updater.onError(e))

    setTimeout(() => void updater.scheduledCheck(), FIRST_CHECK_DELAY)
    setInterval(() => void updater.scheduledCheck(), CHECK_INTERVAL)
  },

  onError(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e)
    if (isNothingPublished(message)) {
      set({ state: 'up-to-date', error: undefined })
      return
    }
    if (status.state === 'downloading') {
      // The download failed: offer the release page so the user is never stuck
      set({ state: 'available', error: manualCheck ? message : undefined })
      return
    }
    // Background checks fail quietly (offline, GitHub rate limit); only a check the user asked for reports it
    set(manualCheck ? { state: 'error', error: message } : { state: 'idle', error: undefined })
  },

  async scheduledCheck(): Promise<void> {
    if (!settings.get().autoUpdate) return
    if (status.state === 'downloading' || status.state === 'downloaded' || status.state === 'checking') return
    await updater.run(false)
  },

  async run(manual: boolean): Promise<void> {
    if (status.state === 'unsupported') return
    manualCheck = manual
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      updater.onError(e)
    } finally {
      manualCheck = false
    }
  },

  status(): UpdateStatus {
    return status
  },

  async check(): Promise<UpdateStatus> {
    if (status.state !== 'downloading' && status.state !== 'downloaded') await updater.run(true)
    return status
  },

  install(): void {
    if (status.state !== 'downloaded') return
    // Silent install keeps the chosen folder and relaunches the app when it is done
    autoUpdater.quitAndInstall(true, true)
  },

  async openRelease(): Promise<void> {
    await shell.openExternal(status.releaseUrl)
  }
}
