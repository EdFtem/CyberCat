import { pluralEn } from '../../plural'

/** Generic dialogs: input, confirm, permissions, properties, about */
export const dialogs = {
  chmodTitle: 'Permissions',
  chmodMixed: 'permissions differ',
  chmodRead: 'Read',
  chmodWrite: 'Write',
  chmodExecute: 'Execute',
  chmodOwner: 'Owner',
  chmodGroup: 'Group',
  chmodOthers: 'Others',
  chmodOctalHint: 'e.g. 644',
  chmodRecursive: 'Apply recursively to folder contents',
  chmodDone: 'Permissions changed',
  chmodDoneMessage: (mode: string, n: number) => `${mode} applied to ${n} ${pluralEn(n, 'item', 'items')}`,
  chmodFailed: 'Could not change permissions',

  propPath: 'Path',
  propType: 'Type',
  propDrive: 'Drive',
  propSymlink: 'Symbolic link',
  propSymlinkToFolder: 'Symbolic link to folder',
  propFolder: 'Folder',
  propFile: 'File',
  propTarget: 'Target',
  propSize: 'Size',
  propBytes: (n: string) => `${n} bytes`,
  propModified: 'Modified',
  propPermissions: 'Permissions',
  propOwner: 'Owner',
  propLocation: 'Location',
  propLocalComputer: 'Local computer',
  propServer: 'Server',

  aboutTitle: 'About CyberCat',
  aboutDescription: 'Graphical SSH/SFTP file manager. Electron, React, ssh2, Monaco, xterm.js.'
}
