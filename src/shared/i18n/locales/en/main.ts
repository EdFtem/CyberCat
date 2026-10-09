/** Errors, toasts and status messages created in the Electron main process */
export const main = {
  app: {
    pickFile: 'Select a file',
    pickFolder: 'Select a folder',
    httpOnly: 'Only http(s) links are allowed',
    /** Default reason for rejecting pending dialogs */
    cancelled: 'Cancelled',
    quitting: 'The app is closing'
  },

  /** Generic messages for remote commands */
  exec: {
    failed: (cmd: string) => `${cmd} failed`,
    exitCode: (cmd: string, code: number) => `${cmd} exited with code ${code}`,
    timeout: (seconds: number) => `Command did not finish within ${seconds} s`,
    shellRequired: 'Shell access on the server is required'
  },

  session: {
    notConnected: 'Session is not connected',
    notFound: 'Session not found',
    closed: 'Session closed',
    disconnected: 'Session disconnected',
    profileNotFound: 'Profile not found',
    noProfile: 'No connection profile specified',
    closedByServer: 'Connection closed by the server',
    reconnecting: (attempt: number, max: number) => `Connection lost, reconnecting (attempt ${attempt} of ${max})`,
    reconnectFailed: 'Could not restore the connection',
    connectionLost: 'Connection lost'
  },

  ssh: {
    connectCancelled: 'Connection cancelled',
    keyReadFailed: (path: string, error: string) => `Could not read key ${path}: ${error}`,
    keyDecryptFailed: (error: string) => `Could not decrypt key: ${error}`,
    noKeyFile: 'No private key file specified',
    emptyProxyJump: 'ProxyJump is empty',
    jumpTunnelFailed: (host: string, port: number, error: string) => `tunnel to ${host}:${port} failed: ${error}`,
    jumpHostError: (host: string, error: string) => `Jump host ${host}: ${error}`,
    authFailed: 'Authentication failed: wrong password, key or username',
    connectionRefused: 'The server refused the connection. Check the address and port',
    hostNotFound: 'Host not found. Check the address',
    timedOut: 'Connection timed out. The server is not responding',
    hostKeyRejected: 'Host key rejected',
    agentUnavailable: 'SSH agent is not available. Start ssh-agent or Pageant'
  },

  sudo: {
    needsShell: 'sudo mode requires shell access on the server',
    notInstalled: 'sudo is not installed on the server',
    notAllowed: (user: string) => `User ${user} is not allowed to run sudo`,
    requiresTty: 'sudoers requires a tty (requiretty), sudo mode is unavailable',
    passwordPrompt: (user: string, host: string) => `sudo password for ${user}@${host}`,
    wrongPasswordRetry: 'Incorrect sudo password, try again',
    wrongPassword: 'Incorrect sudo password',
    cancelled: 'sudo cancelled',
    commandsOnlyTitle: 'sudo is on for commands only',
    commandsOnlyMessage:
      'sftp-server was not found on the server, so file operations run as your user. Docker, the terminal and commands run as root.'
  },

  docker: {
    notFound: 'Neither docker nor podman was found on the server',
    daemonDenied: (user: string) =>
      `User ${user} has no access to the Docker daemon. Turn on sudo mode or add the user to the docker group`,
    daemonNotRunning: 'Docker daemon is not running',
    unavailable: 'Docker is unavailable'
  },

  fs: {
    alreadyExists: (path: string) => `A file or folder already exists: ${path}`,
    notAFolder: (path: string) => `Path exists but is not a folder: ${path}`,
    isFolder: 'This is a folder, not a file',
    unexpectedEof: 'Unexpected end of file while reading',
    copyNeedsShell: 'Copying on the server requires shell access'
  },

  transfer: {
    destUnavailable: 'Destination folder is not available',
    addFailed: (name: string) => `Could not add ${name}`,
    deleteSourceFailed: (name: string) => `Could not delete source ${name}`,
    waitingForReconnect: 'Waiting for the connection to be restored',
    reconnected: 'Connection restored',
    resumed: (count: number) => `Transfers resumed: ${count}`,
    remoteShrank: 'The file on the server got shorter during the transfer',
    localShrank: 'The local file got shorter during the transfer'
  },

  editor: {
    launchFailed: 'Could not start the editor',
    tooLarge: 'File is too large to edit',
    uploadFailed: (name: string) => `Could not upload ${name}`
  },

  search: {
    nothingToFind: 'Enter a name or text to search for',
    noFolder: 'No folder specified for the search',
    sftpContentWarning: 'Shell is not available, so the content search ran over SFTP and may be slow'
  },

  tail: {
    exitedImmediately: 'The command exited right after it started',
    /** Inserted into the live view when the file shrinks */
    truncated: '[file truncated or replaced]'
  },

  sync: {
    watchFailed: (error: string) => `Could not watch the folder: ${error}`,
    watchStarted: 'Watch mode on'
  },

  tunnel: {
    forwardingDenied:
      'The server does not allow port forwarding (AllowTcpForwarding no in sshd_config) or the port is unavailable',
    failed: (host: string, port: number) => `Tunnel to ${host}:${port} is not working`
  }
}
