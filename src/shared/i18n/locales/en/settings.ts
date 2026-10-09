export const settings = {
  title: 'Settings',
  language: 'Language',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  externalEditor: 'External editor',
  externalEditorHint:
    'Command used to open a file. Empty = the system default app. Use <code>%f</code> for the file path, for example <code>code --wait %f</code> or <code>"C:\\Program Files\\Notepad++\\notepad++.exe"</code>.',
  pickProgram: 'Choose a program',
  sshAgent: 'SSH agent',
  agentHintWindows: 'Empty = \\\\.\\pipe\\openssh-ssh-agent or SSH_AUTH_SOCK. For PuTTY, enter pageant',
  agentHintPosix: 'Empty = SSH_AUTH_SOCK',
  agentPlaceholder: 'auto',
  concurrency: 'Concurrent transfers',
  showHidden: 'Show hidden files',
  confirmDelete: 'Confirm before deleting',
  customCommands: 'Custom server commands',
  customCommandsHint:
    'One per line: <code>Name = command</code>. Placeholders: <code>%f</code> selected files (full paths), <code>%n</code> names only, <code>%d</code> current folder. They appear in the context menu of the server pane.',
  customCommandsPlaceholder:
    'Folder sizes = du -sh %f\nSet 644 recursively = chmod -R 644 %f\nRestart nginx = sudo systemctl restart nginx && systemctl status nginx --no-pager',
  shortcutsButton: 'Keyboard shortcuts'
}
