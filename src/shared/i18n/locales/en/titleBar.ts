import { pluralEn } from '../../plural'

export const titleBar = {
  connections: 'Connections',
  closeSession: 'Close session',
  newConnection: 'New connection',
  externalEdits: 'External editing',
  tunnels: 'Port tunnels',
  watches: 'Watched folders',
  transfers: 'Transfers',
  lightTheme: 'Light theme',
  darkTheme: 'Dark theme',
  settings: 'Settings (Ctrl+,)',

  tunnelsHeading: 'Port tunnels over SSH',
  tunnelConnections: (n: number) => `connections: ${n}`,
  openInBrowser: 'Open in browser',
  closeTunnel: 'Close tunnel',

  watchesHeading: 'Folders in watch mode',
  watchUploaded: (n: number, time: string) => `Changes uploaded: ${n}, last at ${time}`,
  watchIdle: 'Waiting for changes in the folder',
  stopWatching: 'Stop watching',

  editsHeading: 'Files in the external editor',
  noOpenFiles: 'No open files',
  editUploaded: (n: number, time: string) => `Uploaded ${n} ${pluralEn(n, 'time', 'times')}, last at ${time}`,
  editIdle: 'Waiting for changes in the file',
  uploadNow: 'Upload now',
  finishEditing: 'Stop editing'
}
