import { pluralEn } from '../../plural'

const items = (n: number): string => `${n} ${pluralEn(n, 'item', 'items')}`

/** Dialogs, confirmations and toasts raised by file operations */
export const ops = {
  // Name validation
  nameRequired: 'Enter a name',
  nameInvalid: 'Invalid name',
  nameNoSlashes: 'Name cannot contain / or \\',

  // Opening files
  openFailed: 'Could not open',
  notTextTitle: 'This doesn’t look like a text file',
  notTextMessage: (name: string) => `${name} is probably not a text file. Open it in the editor anyway?`,
  externalEditor: 'External editor',

  // New folder / new file
  newFolder: 'New folder',
  folderName: 'Folder name',
  folderPlaceholder: 'new-folder',
  createFolderFailed: 'Could not create folder',
  newFile: 'New file',
  fileName: 'File name',
  createFileFailed: 'Could not create file',

  // Rename
  renameTitle: 'Rename',
  renameFailed: 'Could not rename',

  // Move to folder
  moveTitle: (name: string) => `Move ${name}`,
  moveItemsTitle: (n: number) => `Move ${items(n)}`,
  destinationFolder: 'Destination folder',
  move: 'Move',
  moveSomeFailed: 'Some items could not be moved',
  moved: 'Moved',
  movedMessage: (n: number, dest: string) => `${items(n)} to ${dest}`,

  // Delete
  deleted: 'Deleted',
  deleteSomeFailed: 'Some items could not be deleted',
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteItemsTitle: (n: number) => `Delete ${items(n)}?`,
  deleteWithFolders: 'Folders will be deleted with all their contents. This cannot be undone.',
  deleteIrreversible: 'This cannot be undone.',
  andMore: (n: number) => `… and ${n} more`,

  // Transfers between panes
  chooseLocalFolder: 'Choose a local folder',
  chooseLocalFolderMessage: 'The local pane is showing the drive list.',
  transferStartFailed: 'Could not start transfer',
  moveToServerTitle: (n: number) => `Move ${items(n)} to server?`,
  moveToComputerTitle: (n: number) => `Move ${items(n)} to computer?`,
  moveToOtherMessage: (dest: string) => `Destination: ${dest}. Each source file is deleted once it has been transferred successfully.`,
  moveStartFailed: 'Could not start move',

  // Clipboard
  pathCopied: 'Path copied',
  pathsCount: (n: number) => `${n} ${pluralEn(n, 'path', 'paths')}`,
  cut: 'Cut',
  copied: 'Copied',
  clipboardMessage: (n: number) => `${items(n)} · Ctrl+V to paste`,
  pasteAcrossSessions: 'Pasting between sessions is not supported yet',
  pasteFailed: 'Could not paste',
  pasteSomeFailed: 'Some items could not be pasted',

  // Bookmarks
  bookmarkRemoved: 'Bookmark removed',
  bookmarkAdded: 'Bookmark added',

  // Docker
  dockerLogsFailed: 'Could not open logs',
  dockerShellFailed: 'Could not open a shell in the container'
}
