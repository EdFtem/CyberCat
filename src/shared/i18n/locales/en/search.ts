import { pluralEn } from '../../plural'

export const search = {
  titleLocal: 'Search on this computer',
  titleRemote: 'Search on the server',
  matches: (n: number) => `${n} ${pluralEn(n, 'match', 'matches')}`,
  truncated: 'showing the first results, refine your query',
  viaSftp: 'via SFTP',
  run: 'Search',

  name: 'File name',
  nameHint: 'Substring or pattern with * and ?',
  content: 'Containing text',
  contentHintLocal: 'Files up to 4 MB',
  contentHintRemote: 'Uses grep if a shell is available',
  root: 'Look in',
  caseSensitive: 'Match case',

  nothingFound: 'Nothing found',
  hint: 'Type a file name or text and press Enter',

  reveal: 'Show in pane',
  goTo: 'Go to folder',
  openInEditor: 'Open in editor'
}
