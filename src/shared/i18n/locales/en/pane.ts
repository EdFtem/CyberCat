import { pluralEn } from '../../plural'

const items = (n: number): string => `${n} ${pluralEn(n, 'item', 'items')}`

/** File pane: toolbar, file list, path bar, context menus */
export const pane = {
  /** Root of the Windows drive list */
  thisPc: 'This PC',

  // Header
  localComputer: 'Local computer',
  sudoFilesTitle: 'Files and commands run as root',
  sudoCommandsTitle: 'Commands run as root, file operations as your user: sftp-server not found on the server',
  sudoCommandsBadge: 'root: commands',
  back: 'Back',
  forward: 'Forward',
  up: 'Up (Backspace)',
  homeFolder: 'Home folder',
  bookmarks: 'Bookmarks',
  refreshHint: 'Refresh (Ctrl+R)',

  // Action bar
  newFolderHint: 'New folder (F7)',
  newFileHint: 'New file (Ctrl+Shift+N)',
  downloadSelectedHint: 'Download selected to computer (F5)',
  uploadSelectedHint: 'Upload selected to server (F5)',
  renameHint: 'Rename (F2)',
  deleteHint: 'Delete (Del)',
  permissions: 'Permissions',
  sudoOff: 'Disable sudo mode',
  sudoOn: 'sudo mode: run operations as root',
  compareWithLocal: 'Compare with a local folder',
  terminalHere: 'Terminal in this folder',
  searchHint: 'Search (Ctrl+Shift+F)',
  hideHiddenHint: 'Hide hidden files (Ctrl+H)',
  showHiddenHint: 'Show hidden files (Ctrl+H)',
  filterHint: 'Filter (Ctrl+F)',
  filterPlaceholder: 'Filter by name…',
  closeFilter: 'Close filter',

  // Footer
  itemsOf: (n: number, total: number) => `${n} of ${total} ${pluralEn(total, 'item', 'items')}`,
  selectedCount: (n: number) => `${n} selected`,
  diskFree: (free: string) => `${free} free`,
  diskFreeOf: (free: string, total: string) => `${free} free of ${total}`,

  // Column headers
  colName: 'Name',
  colSize: 'Size',
  colModified: 'Modified',
  colPermissions: 'Permissions',
  colOwner: 'Owner',

  // Empty states
  openFolderFailed: 'Could not open folder',
  noMatches: 'No matches',
  folderEmpty: 'This folder is empty',
  filterNoMatches: (filter: string) => `No items match “${filter}”`,
  hiddenFilesOff: 'Hidden files are not shown (Ctrl+H)',

  // Bookmarks menu
  removeBookmark: 'Remove current folder from bookmarks',
  addBookmark: 'Add current folder to bookmarks',

  // Context menu
  newFolder: 'New folder',
  newFile: 'New file',
  paste: 'Paste',
  searchHere: 'Search in this folder…',
  compareWithLocalMenu: 'Compare with a local folder…',
  showHidden: 'Show hidden files',
  openTerminalHere: 'Open terminal here',
  showInFileManager: 'Show in file manager',
  copyFolderPath: 'Copy folder path',
  openInEditor: 'Open in editor',
  editExternal: 'Edit in external editor',
  openWithSystem: 'Open with default app',
  followLog: 'Follow log',
  downloadToComputer: (n: number) => (n > 1 ? `Download ${items(n)} to computer` : 'Download to computer'),
  uploadToServer: (n: number) => (n > 1 ? `Upload ${items(n)} to server` : 'Upload to server'),
  moveToComputer: 'Move to computer',
  moveToServer: 'Move to server',
  moveToFolder: 'Move to folder…',
  cut: 'Cut',
  batchRename: 'Batch rename…',
  permissionsMenu: 'Permissions…',
  copyPath: 'Copy path',
  properties: 'Properties'
}
