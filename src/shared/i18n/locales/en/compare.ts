import { pluralEn } from '../../plural'

type Counts = { same: number; onlyLocal: number; onlyRemote: number; different: number }
type PlanCounts = { upload: number; download: number; delete: number; skip: number }
type SyncCounts = { upload: number; download: number; deleted: number }

export const compare = {
  title: 'Compare and sync folders',
  subtitle: 'Local folder on the left, server on the right. The direction decides what happens to the differences.',
  summary: (c: Counts) => `${c.same} identical · ${c.onlyLocal} only local · ${c.onlyRemote} only on server · ${c.different} different`,
  truncated: 'list truncated',

  localDir: 'Local folder',
  remoteDir: 'Server folder',
  run: 'Compare',
  byHash: 'Compare contents by sha256 for files of the same size (slower)',

  scanning: 'Scanning folders…',
  hint: 'Click “Compare” to see the differences',
  identical: 'The folders are identical',

  colPath: 'Path',
  colLocal: 'Local',
  colRemote: 'Server',
  colDiff: 'Difference',
  colAction: 'Action',
  missing: 'missing',

  onlyLocal: 'only local',
  onlyRemote: 'only on server',
  different: 'different',
  reasons: { size: 'size', mtime: 'date', hash: 'content', type: 'type' },
  newerLocal: (reason: string) => `${reason}, newer locally`,
  newerRemote: (reason: string) => `${reason}, newer on server`,

  actions: {
    upload: 'to server',
    download: 'to computer',
    deleteLocal: 'delete locally',
    deleteRemote: 'delete on server',
    skip: 'skip'
  },

  dirUpload: 'Local → server',
  dirDownload: 'Server → local',
  dirNewer: 'Newer wins',
  mirror: 'Mirror: delete files in the destination that are missing from the source',
  watchAfter: 'Then watch the local folder and upload changes',
  plan: (c: PlanCounts) =>
    `Plan: ${c.upload} ${pluralEn(c.upload, 'file', 'files')} to server, ${c.download} to computer` +
    (c.delete > 0 ? `, ${c.delete} to delete` : '') +
    (c.skip > 0 ? `, ${c.skip} to skip` : ''),

  syncStarted: 'Sync started',
  syncSummary: (c: SyncCounts) =>
    [c.upload && `${c.upload} to server`, c.download && `${c.download} to computer`, c.deleted && `${c.deleted} deleted`].filter(Boolean).join(', ')
}
