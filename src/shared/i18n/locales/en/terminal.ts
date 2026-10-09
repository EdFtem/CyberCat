/** Terminal panel and the service lines written into xterm */
export const terminal = {
  connecting: (host?: string) => (host ? `Connecting to ${host}…` : 'Connecting to the server…'),
  sessionEnded: '[session ended]',
  openFailed: (message: string) => `Could not open terminal: ${message}`,
  title: 'Terminal',
  hideHint: 'Ctrl+` to hide',
  close: 'Close terminal'
}
