// Спільні типи для main, preload та renderer

export type AuthMethod = 'password' | 'key' | 'agent'

export interface Profile {
  id: string
  name: string
  host: string
  port: number
  username: string
  auth: AuthMethod
  keyPath?: string
  /** Проміжні хости у форматі OpenSSH: [user@]host[:port], кілька через кому */
  proxyJump?: string
  savePassword: boolean
  /** Обчислюється у main: чи є збережений пароль */
  hasPassword?: boolean
  color?: string
  group?: string
  remotePath?: string
  localPath?: string
  createdAt: number
  lastUsedAt?: number
}

export type Target = 'local' | string

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  isSymlink: boolean
  size: number
  /** мс від епохи */
  mtime: number
  /** лише біти прав, 0..0o7777 */
  mode: number
  owner?: string
  group?: string
  linkTarget?: string
  /** для Windows-дисків у локальній панелі */
  isDrive?: boolean
}

export interface ListResult {
  path: string
  entries: FileEntry[]
}

export type SessionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export interface SessionInfo {
  id: string
  profileId?: string
  name: string
  host: string
  port: number
  username: string
  status: SessionStatus
  error?: string
  homeDir?: string
  hasShell: boolean
  color?: string
  startRemotePath?: string
  startLocalPath?: string
}

export type TransferDirection = 'upload' | 'download'
export type TransferStatus =
  | 'scanning'
  | 'queued'
  | 'running'
  | 'paused'
  | 'done'
  | 'error'
  | 'cancelled'
  | 'skipped'

export interface TransferItem {
  id: string
  sessionId: string
  sessionName: string
  direction: TransferDirection
  src: string
  dst: string
  name: string
  size: number
  transferred: number
  status: TransferStatus
  speed: number
  error?: string
  startedAt?: number
  finishedAt?: number
  resumeFrom?: number
}

export type OverwritePolicy = 'ask' | 'overwrite' | 'skip' | 'resume'

export interface TransferSource {
  path: string
  name: string
  isDir: boolean
}

export interface TransferRequest {
  sessionId: string
  direction: TransferDirection
  sources: TransferSource[]
  destDir: string
  policy?: OverwritePolicy
}

export interface TransferSummary {
  items: TransferItem[]
  active: number
  totalSpeed: number
}

export type Eol = 'LF' | 'CRLF'

export interface OpenTextResult {
  path: string
  content: string
  encoding: string
  eol: Eol
  mtime: number
  size: number
  mode: number
  truncated: boolean
}

export interface SaveTextRequest {
  target: Target
  path: string
  content: string
  eol: Eol
  encoding: string
  expectedMtime?: number
  force?: boolean
}

export interface SaveTextResult {
  ok: boolean
  conflict?: boolean
  currentMtime?: number
  mtime?: number
  size?: number
  error?: string
}

export type ExternalEditStatus = 'downloading' | 'watching' | 'uploading' | 'error' | 'closed'

export interface ExternalEdit {
  id: string
  sessionId: string
  remotePath: string
  localPath: string
  name: string
  status: ExternalEditStatus
  lastUpload?: number
  uploads: number
  error?: string
}

export interface AppSettings {
  theme: 'dark' | 'light'
  externalEditor: string
  showHidden: boolean
  confirmDelete: boolean
  agentPath: string
  transferConcurrency: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  externalEditor: '',
  showHidden: false,
  confirmDelete: true,
  agentPath: '',
  transferConcurrency: 2
}

// Запити з main до renderer (діалоги)
export type PromptKind = 'hostkey' | 'auth' | 'password' | 'passphrase' | 'overwrite'

export interface HostKeyPrompt {
  host: string
  port: number
  keyType: string
  fingerprint: string
  status: 'new' | 'changed'
  previousFingerprint?: string
}
export interface HostKeyAnswer {
  accept: boolean
  remember: boolean
}

export interface AuthPrompt {
  host: string
  username: string
  name: string
  instructions: string
  prompts: { prompt: string; echo: boolean }[]
}
export interface AuthAnswer {
  responses: string[] | null
}

export interface PasswordPrompt {
  host: string
  username: string
  canSave: boolean
  reason?: string
}
export interface PasswordAnswer {
  password: string | null
  save: boolean
}

export interface PassphrasePrompt {
  keyPath: string
}
export interface PassphraseAnswer {
  passphrase: string | null
}

export interface OverwritePrompt {
  direction: TransferDirection
  src: string
  dst: string
  srcSize: number
  dstSize: number
  srcMtime: number
  dstMtime: number
  canResume: boolean
}
export interface OverwriteAnswer {
  action: 'overwrite' | 'skip' | 'resume' | 'cancel'
  applyToAll: boolean
}

export interface PromptRequest {
  id: string
  kind: PromptKind
  payload: HostKeyPrompt | AuthPrompt | PasswordPrompt | PassphrasePrompt | OverwritePrompt
}

export interface ConnectRequest {
  profileId?: string
  /** разове підключення без профілю */
  adHoc?: Omit<Profile, 'id' | 'createdAt'>
  password?: string
  /** перепідключення існуючої сесії */
  sessionId?: string
}

export interface DiskUsage {
  total: number
  free: number
}

export interface Toast {
  id: string
  kind: 'info' | 'success' | 'error' | 'warning'
  title: string
  message?: string
}

// ---- Імпорт ~/.ssh/config
export interface SshConfigHost {
  alias: string
  host: string
  port: number
  user?: string
  identityFile?: string
  proxyJump?: string
  /** Чи вже є профіль з такою ж адресою та користувачем */
  exists?: boolean
}

// ---- Живий перегляд логів
export interface TailStartRequest {
  target: Target
  path: string
  lines?: number
}
export interface TailData {
  tailId: string
  data: string
  /** Порядковий номер фрагмента; фрагменти з seq <= snapshot.seq уже є у знімку */
  seq: number
}
export interface TailSnapshot {
  text: string
  seq: number
}
export interface TailExit {
  tailId: string
  error?: string
}

// ---- Пошук
export interface SearchRequest {
  target: Target
  root: string
  name?: string
  content?: string
  caseSensitive?: boolean
  maxResults?: number
}
export interface SearchHit {
  entry: FileEntry
  line?: number
  text?: string
}
export interface SearchResponse {
  hits: SearchHit[]
  truncated: boolean
  method: 'shell' | 'walk'
  warning?: string
}
