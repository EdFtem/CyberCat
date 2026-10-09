/** Transfers panel: queue header and per-item rows */
export const transfers = {
  title: 'Transfers',
  queued: (n: number) => `${n} queued`,
  queueEmpty: 'Queue is empty',
  cancelAll: 'Cancel all',
  clearFinished: 'Clear finished',
  collapse: 'Collapse',
  emptyTitle: 'No transfers yet',
  emptyDescription: 'Drag files between the panes or press F5 on the selected files.',

  status: {
    running: 'Transferring',
    queued: 'Queued',
    paused: 'Paused',
    done: 'Done',
    error: 'Error',
    cancelled: 'Cancelled',
    skipped: 'Skipped'
  },
  upload: 'Upload',
  download: 'Download',

  pause: 'Pause',
  postpone: 'Postpone',
  resume: 'Resume',
  remove: 'Remove from list'
}
