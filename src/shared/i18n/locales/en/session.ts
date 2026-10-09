import { pluralEn } from '../../plural'

/** Session layout: connection states and status bar */
export const session = {
  connectFailed: 'Could not connect',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  connectionLost: 'Connection lost',
  reconnect: 'Reconnect',

  sftpOnly: 'SFTP only',
  selection: (pane: 'local' | 'remote', n: number, size?: string) =>
    `${pane === 'local' ? 'Local' : 'Server'}: ${n} ${pluralEn(n, 'item', 'items')} selected${size ? `, ${size}` : ''}`,
  editorFiles: (n: number) => `${n} ${pluralEn(n, 'file', 'files')} in editor`,
  editorTitle: 'Editor (Ctrl+E)',
  terminalTitle: 'Terminal (Ctrl+`)'
}
