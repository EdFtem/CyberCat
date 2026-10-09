/** Toasts and dialogs raised by app-wide actions in the renderer store */
export const store = {
  connectFailed: 'Could not connect',
  closeTabDirtyTitle: 'Close with unsaved changes?',
  closeTabDirtyMessage: 'This session has unsaved files. Your changes will be lost.',
  closeWithoutSaving: 'Close without saving',
  fileTooLarge: 'File is too large',
  fileTooLargeMessage: 'Only the first 8 MB is shown. Saving is disabled, use an external editor instead.',
  openFileFailed: 'Could not open file',
  openLogFailed: 'Could not open log',
  saveDisabled: 'Saving is disabled',
  saveDisabledMessage: 'The file was only partially opened.',
  changedExternallyTitle: 'File changed elsewhere',
  changedExternallyMessage: (name: string) => `${name} was modified after you opened it. Overwrite those changes?`,
  overwrite: 'Overwrite',
  saveFailed: 'Could not save',
  closeDocDirtyTitle: 'Close without saving?',
  closeDocDirtyMessage: (name: string) => `${name} has unsaved changes.`,
  sudoOn: 'sudo mode on',
  sudoOff: 'sudo mode off',
  sudoOnMessage: 'Server operations now run as root. Be careful.'
}
