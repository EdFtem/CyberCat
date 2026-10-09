import type {
  AppSettings,
  ConnectRequest,
  DiskUsage,
  ExternalEdit,
  FileEntry,
  ListResult,
  OpenTextResult,
  Profile,
  PromptRequest,
  SaveTextRequest,
  SaveTextResult,
  SearchRequest,
  SearchResponse,
  SessionInfo,
  SshConfigHost,
  TailData,
  TailExit,
  TailSnapshot,
  Target,
  Toast,
  TransferRequest,
  TransferSummary
} from './types'

export type Unsubscribe = () => void

export interface AppInfo {
  platform: string
  home: string
  version: string
  sep: string
}

/** Контракт між preload (window.api) та renderer */
export interface Api {
  app: {
    info(): Promise<AppInfo>
    pickFile(opts?: { title?: string; defaultPath?: string }): Promise<string | null>
    pickDirectory(opts?: { title?: string; defaultPath?: string }): Promise<string | null>
    openPath(p: string): Promise<void>
    showInFolder(p: string): Promise<void>
    setTitleBarOverlay(o: { color: string; symbolColor: string }): Promise<void>
    getPathForFile(f: File): string
  }
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  profiles: {
    list(): Promise<Profile[]>
    save(p: Profile, password?: string | null): Promise<Profile>
    remove(id: string): Promise<void>
  }
  sessions: {
    connect(req: ConnectRequest): Promise<SessionInfo>
    disconnect(id: string): Promise<void>
    remove(id: string): Promise<void>
    list(): Promise<SessionInfo[]>
  }
  fs: {
    list(target: Target, path: string): Promise<ListResult>
    stat(target: Target, path: string): Promise<FileEntry>
    mkdir(target: Target, path: string): Promise<void>
    createFile(target: Target, path: string): Promise<void>
    rename(target: Target, from: string, to: string): Promise<void>
    remove(target: Target, items: { path: string; isDir: boolean }[]): Promise<void>
    chmod(target: Target, paths: string[], mode: number, recursive: boolean): Promise<void>
    home(target: Target): Promise<string>
    realpath(target: Target, path: string): Promise<string>
    diskUsage(target: Target, path: string): Promise<DiskUsage | null>
  }
  text: {
    open(target: Target, path: string): Promise<OpenTextResult>
    save(req: SaveTextRequest): Promise<SaveTextResult>
  }
  transfer: {
    enqueue(req: TransferRequest): Promise<void>
    list(): Promise<TransferSummary>
    pause(id: string): Promise<void>
    resume(id: string): Promise<void>
    cancel(id: string): Promise<void>
    retry(id: string): Promise<void>
    remove(id: string): Promise<void>
    clearFinished(): Promise<void>
    cancelAll(): Promise<void>
  }
  extedit: {
    open(sessionId: string, path: string): Promise<ExternalEdit>
    close(id: string): Promise<void>
    list(): Promise<ExternalEdit[]>
    uploadNow(id: string): Promise<void>
  }
  terminal: {
    open(sessionId: string, cols: number, rows: number, cwd?: string): Promise<string>
    write(termId: string, data: string): void
    resize(termId: string, cols: number, rows: number): void
    close(termId: string): Promise<void>
  }
  prompt: {
    answer(id: string, answer: unknown): Promise<void>
  }
  sshconfig: {
    list(): Promise<SshConfigHost[]>
    import(aliases: string[]): Promise<Profile[]>
  }
  tail: {
    start(target: Target, path: string, lines?: number): Promise<string>
    snapshot(tailId: string): Promise<TailSnapshot>
    stop(tailId: string): Promise<void>
  }
  search: {
    run(req: SearchRequest): Promise<SearchResponse>
  }
  on: {
    sessionUpdate(cb: (info: SessionInfo) => void): Unsubscribe
    sessionReconnected(cb: (id: string) => void): Unsubscribe
    transferUpdate(cb: (s: TransferSummary) => void): Unsubscribe
    exteditUpdate(cb: (list: ExternalEdit[]) => void): Unsubscribe
    terminalData(cb: (p: { termId: string; data: Uint8Array }) => void): Unsubscribe
    terminalExit(cb: (p: { termId: string }) => void): Unsubscribe
    promptRequest(cb: (req: PromptRequest) => void): Unsubscribe
    toast(cb: (t: Toast) => void): Unsubscribe
    tailData(cb: (d: TailData) => void): Unsubscribe
    tailExit(cb: (d: TailExit) => void): Unsubscribe
  }
}
