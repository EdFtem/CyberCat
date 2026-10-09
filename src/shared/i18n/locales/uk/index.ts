import type { Messages } from '../en'
import { common } from './common'
import { format } from './format'
import { app } from './app'
import { store } from './store'
import { titleBar } from './titleBar'
import { dialogs } from './dialogs'
import { settings } from './settings'
import { main } from './main'
import { home } from './home'
import { sshImport } from './sshImport'
import { prompts } from './prompts'
import { pane } from './pane'
import { ops } from './ops'
import { docker } from './docker'
import { dockerInspect } from './dockerInspect'
import { compare } from './compare'
import { massRename } from './massRename'
import { search } from './search'
import { command } from './command'
import { editor } from './editor'
import { logView } from './logView'
import { session } from './session'
import { terminal } from './terminal'
import { transfers } from './transfers'

export const uk: Messages = {
  common,
  format,
  app,
  store,
  titleBar,
  dialogs,
  settings,
  main,
  home,
  sshImport,
  prompts,
  pane,
  ops,
  docker,
  dockerInspect,
  compare,
  massRename,
  search,
  command,
  editor,
  logView,
  session,
  terminal,
  transfers
}
