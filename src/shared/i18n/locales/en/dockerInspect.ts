/** Container details dialog (docker inspect) */
export const dockerInspect = {
  structured: 'Structured',
  json: 'JSON',
  none: 'None',

  general: 'General',
  state: 'State',
  exitCode: (code: number) => `exit code ${code}`,
  started: 'Started',
  created: 'Created',
  command: 'Command',
  restarts: 'Restarts',
  restartsValue: (count: number, policy: string) => `${count} · restart policy ${policy}`,
  workingDir: 'Working directory',
  user: 'User',

  ports: 'Ports',
  notPublished: 'not published',

  mounts: 'Mounts',
  openOnHostTitle: 'Open the host folder in the file pane',
  openOnHost: 'On host',

  networks: 'Networks',
  gateway: (ip: string) => `gateway ${ip}`,

  environment: 'Environment',
  showSecrets: 'show secrets',

  labels: 'Labels'
}
