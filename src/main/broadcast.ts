import { BrowserWindow } from 'electron'

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, ...args)
  }
}

export function toast(kind: 'info' | 'success' | 'error' | 'warning', title: string, message?: string): void {
  broadcast('toast', { id: Math.random().toString(36).slice(2), kind, title, message })
}
