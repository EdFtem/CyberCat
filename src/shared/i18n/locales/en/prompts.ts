/** Modal prompts raised during connection and transfers */
export const prompts = {
  hostKey: {
    changedTitle: 'The host key has changed',
    unknownTitle: 'Unknown server',
    changedMessage:
      'The host key fingerprint doesn’t match the one saved for this server. This could mean the server was reinstalled, or that someone is intercepting the connection (a man-in-the-middle attack). Continue only if you are sure.',
    unknownMessage:
      'You are connecting to this server for the first time. Verify the host key fingerprint with the server administrator to make sure it is the real server.',
    keyType: 'Key type',
    fingerprint: 'Fingerprint',
    previous: 'Previous',
    replaceKey: 'Replace the saved host key',
    rememberKey: 'Remember the host key for this server',
    reject: 'Reject',
    connectAnyway: 'Connect anyway',
    connect: 'Connect'
  },

  password: {
    sudoTitle: 'sudo password',
    title: 'Enter password',
    label: 'Password',
    save: 'Save password in the profile (encrypted by the OS)',
    connect: 'Connect'
  },

  passphrase: {
    title: 'Key is passphrase-protected',
    label: 'Key passphrase',
    unlock: 'Unlock'
  },

  auth: {
    title: 'Additional authentication',
    info: 'The server is asking for a response (password, 2FA code, etc.)'
  },

  overwrite: {
    title: 'File already exists',
    applyToAll: 'Apply to all',
    skip: 'Skip',
    resume: 'Resume',
    overwrite: 'Overwrite',
    localSource: 'Local (source)',
    serverSource: 'Server (source)',
    localExisting: 'Local (existing)',
    serverExisting: 'Server (existing)',
    resumeHint: 'The destination file is smaller than the source. “Resume” continues the transfer from its current size.',
    newer: 'newer'
  }
}
