import { pluralEn } from '../../plural'

export const massRename = {
  title: (n: number) => `Batch rename · ${n} ${pluralEn(n, 'item', 'items')}`,
  willChange: (n: number) => `${n} will change`,
  noChanges: 'No changes',
  hasConflicts: 'conflicts found',

  modeReplace: 'Find and replace',
  modeTemplate: 'Template',

  find: 'Find',
  replaceWith: 'Replace with',
  groupsHint: 'Use $1, $2 for capture groups',
  regex: 'Regular expression',
  ignoreCase: 'Ignore case',
  lowercase: 'Convert to lowercase',

  template: 'Template',
  templateHint: '{name} name without extension, {ext} extension with the dot, {n} number, {date} modified date',
  start: 'Start {n}',
  digits: 'Digits',

  problemEmpty: 'empty name',
  problemSlash: 'contains / or \\',
  problemDuplicate: 'duplicate in the list',
  problemExists: 'file already exists',

  partialFailure: 'Some items could not be renamed',
  renamed: 'Renamed'
}
