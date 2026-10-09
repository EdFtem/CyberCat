/** Connection manager: the start screen with saved profiles and the connection form */
export const home = {
  searchPlaceholder: 'Search connections…',
  newConnection: 'New connection',
  newShort: 'New',
  importSshConfig: 'Import from ~/.ssh/config',
  emptyTitle: 'No saved connections yet',
  emptyDescription: 'Fill in the form on the right and save it as a profile, or connect right away without saving.',
  ungrouped: 'Ungrouped',
  /** <kbd> wraps the key name */
  connectHint: '<kbd>Enter</kbd> to connect · or double-click a profile',

  auth: {
    password: 'Password',
    key: 'Key',
    agent: 'SSH agent'
  },

  profileFallback: 'Profile',
  editDescription: 'Edit the settings and connect. Changes are saved when you connect.',
  newDescription: 'Connect right away, or save a profile to get back to this server in one click.',

  host: 'Host',
  hostPlaceholder: 'example.com or 10.0.0.5',
  port: 'Port',
  username: 'Username',
  profileName: 'Profile name',
  profileNameHint: 'Empty = user@host',
  profileNamePlaceholder: 'Production server',
  authentication: 'Authentication',
  password: 'Password',
  passwordSavedHint: 'Password saved. Enter a new one to replace it.',
  passwordAskHint: 'Empty = ask when connecting',
  savePassword: 'Save password (encrypted by the OS)',
  privateKey: 'Private key',
  privateKeyHint: 'OpenSSH or PuTTY .ppk. You’ll be asked for the passphrase when connecting.',
  pickKeyTitle: 'Choose a private key',
  agentInfo: 'Keys come from the OpenSSH ssh-agent or Pageant. You can change the agent path in Settings.',

  remotePath: 'Server start folder',
  localPath: 'Local start folder',
  homeFolderHint: 'Empty = home folder',
  pickLocalFolderTitle: 'Local folder',
  proxyJump: 'Jump host (ProxyJump)',
  proxyJumpHint:
    'Optional. OpenSSH format: [user@]bastion[:port], comma-separated for several hops. The user and key come from ~/.ssh/config if it has an entry for that host.',
  group: 'Group',
  groupHint: 'For grouping in the list, e.g. “Production”',
  color: 'Color tag',
  noColor: 'No color',

  connect: 'Connect',
  saveChanges: 'Save changes',
  saveProfile: 'Save profile',

  errors: {
    host: 'Enter the server address',
    username: 'Enter a username',
    port: 'Port must be between 1 and 65535',
    keyPath: 'Choose a key file'
  },

  saveFailed: 'Could not save profile',
  deleteTitle: (name: string) => `Delete profile ${name}?`,
  deleteMessage: 'Its saved password will be deleted too.'
}
