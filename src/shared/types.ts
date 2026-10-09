// Types shared by main, preload and renderer
import type { Lang } from './i18n'

export type AuthMethod = 'password' | 'key' | 'agent'

export interface Profile {
  id: string
  name: string
  host: string
  port: number
  username: string
  auth: AuthMethod
  keyPath?: string
  /** Jump hosts in OpenSSH format: [user@]host[:port], comma-separated */
  proxyJump?: string
  savePassword: boolean
  /** Computed in main: whether a saved password exists */
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
  /** ms since epoch */
  mtime: number
  /** permission bits only, 0..0o7777 */
  mode: number
  owner?: string
  group?: string
  linkTarget?: string
  /** for Windows drives in the local pane */
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
  /** sudo mode is on: commands run as root */
  sudo?: boolean
  /** The file channel runs as root too (sftp-server was found) */
  sudoFiles?: boolean
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
  /** Move: the source is deleted after a successful transfer */
  move?: boolean
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

export interface Bookmark {
  id: string
  label: string
  /** 'local' or the server key user@host:port */
  target: string
  path: string
}

export interface AppSettings {
  theme: 'dark' | 'light'
  /** Interface language */
  language: Lang
  externalEditor: string
  showHidden: boolean
  confirmDelete: boolean
  agentPath: string
  transferConcurrency: number
  /** Custom commands, one per line: Name = command with %f %n %d */
  customCommands: string
  bookmarks: Bookmark[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  externalEditor: '',
  showHidden: false,
  confirmDelete: true,
  agentPath: '',
  transferConcurrency: 2,
  customCommands: '',
  bookmarks: []
}

// Requests from main to the renderer (dialogs)
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
  /** The previous password was rejected: the reason is shown as an error */
  retry?: boolean
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
  /** one-off connection without a profile */
  adHoc?: Omit<Profile, 'id' | 'createdAt'>
  password?: string
  /** reconnect an existing session */
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

// ---- ~/.ssh/config import
export interface SshConfigHost {
  alias: string
  host: string
  port: number
  user?: string
  identityFile?: string
  proxyJump?: string
  /** Whether a profile with the same address and user already exists */
  exists?: boolean
}

// ---- Live log view
export interface TailStartRequest {
  target: Target
  path: string
  lines?: number
}
export interface TailData {
  tailId: string
  data: string
  /** Chunk sequence number; chunks with seq <= snapshot.seq are already in the snapshot */
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

// ---- Search
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

// ---- Folder comparison and sync
export interface CompareRequest {
  sessionId: string
  localDir: string
  remoteDir: string
  byHash?: boolean
}
export interface CompareSide {
  size: number
  mtime: number
}
export interface CompareEntry {
  rel: string
  kind: 'file' | 'dir'
  status: 'only-local' | 'only-remote' | 'different'
  reason?: 'size' | 'mtime' | 'hash' | 'type'
  newer?: 'local' | 'remote'
  local?: CompareSide
  remote?: CompareSide
}
export interface CompareResult {
  entries: CompareEntry[]
  truncated: boolean
  counts: { onlyLocal: number; onlyRemote: number; different: number; same: number }
  hashed: boolean
}

export interface WatchInfo {
  id: string
  sessionId: string
  localDir: string
  remoteDir: string
  events: number
  lastEvent?: number
  status: 'active' | 'error'
  error?: string
}

export interface ExecOutput {
  stdout: string
  stderr: string
  code: number
}

// ---- Docker
export interface DockerInfo {
  available: boolean
  cli: 'docker' | 'podman'
  version?: string
  serverVersion?: string
  compose: boolean
  needsSudo?: boolean
  error?: string
}
export interface DockerPort {
  hostIp?: string
  hostPort?: number
  containerPort: number
  proto: string
}
export interface DockerContainer {
  id: string
  shortId: string
  name: string
  image: string
  state: string
  status: string
  created: string
  command?: string
  ports: DockerPort[]
  labels: Record<string, string>
  project?: string
  service?: string
  composeFiles?: string[]
  composeDir?: string
  cpu?: string
  mem?: string
  memPerc?: string
  netIO?: string
  blockIO?: string
  health?: string
  restarts?: number
  restartPolicy?: string
}
export type DockerContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'kill' | 'rm'
export interface DockerImage {
  id: string
  repository: string
  tag: string
  size: string
  created: string
  dangling: boolean
  inUse: boolean
}
export interface DockerVolume {
  name: string
  driver: string
  mountpoint?: string
  inUse: boolean
}
export interface DockerDiskUsage {
  type: string
  total: number
  active: number
  size: string
  reclaimable: string
}

// ---- Port tunnels
export interface Tunnel {
  id: string
  sessionId: string
  localPort: number
  remoteHost: string
  remotePort: number
  connections: number
}
