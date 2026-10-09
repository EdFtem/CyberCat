import { pluralEn } from '../../plural'

/** Live log view (tail) */
export const logView = {
  resume: (n: number) => `Resume (${n} new)`,
  pause: 'Pause',
  autoScroll: 'Auto-scroll to bottom',
  wrap: 'Wrap long lines',
  clear: 'Clear view',
  filterPlaceholder: 'Filter lines…',

  lineCount: (n: number) => `${n} ${pluralEn(n, 'line', 'lines')}`,
  lineCountFiltered: (shown: number, total: number) => `${shown} of ${total} ${pluralEn(total, 'line', 'lines')}`,
  pausedPending: (n: number) => `+${n} paused`,
  stopped: 'stopped',

  noMatches: 'No lines match the filter',
  waiting: 'Waiting for data…'
}
