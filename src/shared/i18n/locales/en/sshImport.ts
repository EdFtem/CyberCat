import { pluralEn } from '../../plural'

/** Import of hosts from ~/.ssh/config */
export const sshImport = {
  title: 'Import from ~/.ssh/config',
  subtitle: 'Profiles with keys, ports and ProxyJump from your OpenSSH config',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  importButton: (n: number) => (n ? `Import (${n})` : 'Import'),
  noHosts:
    'No Host entries with specific names were found in ~/.ssh/config. Wildcard blocks (* and ?) are skipped, but their options still apply to the imported hosts.',
  profileExists: 'profile exists',
  defaultKeyNote: 'Hosts without an IdentityFile get the first default key found (id_ed25519, id_ecdsa, id_rsa), or password authentication.',
  doneTitle: 'Import complete',
  /** group is the profile group name, kept as is */
  doneMessage: (n: number, group: string) => `${n} ${pluralEn(n, 'profile', 'profiles')} added to the “${group}” group`
}
