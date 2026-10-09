import { create } from 'zustand'
import type { AppInfo } from '@shared/api'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ConnectRequest,
  type DiskUsage,
  type DockerContainer,
  type Eol,
  type ExternalEdit,
  type FileEntry,
  type Profile,
  type PromptRequest,
  type SessionInfo,
  type Target,
  type Toast,
  type TransferSummary,
  type Tunnel,
  type WatchInfo
} from '@shared/types'
import { pathLib, setLocalPlatform } from '@/lib/paths'
import { setLang, tr } from '@/lib/i18n'

export type PaneId = 'local' | 'remote'
export type SortKey = 'name' | 'size' | 'mtime' | 'mode'

export interface PaneState {
  path: string
  entries: FileEntry[]
  loading: boolean
  error?: string
  selected: string[]
  cursor?: string
  anchor?: string
  filter: string
  filterOpen: boolean
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  history: string[]
  historyIndex: number
  renaming?: string
  disk?: DiskUsage | null
}

export interface EditorDoc {
  id: string
  kind: 'text' | 'log'
  tailId?: string
  target: Target
  path: string
  name: string
  content: string
  savedContent: string
  eol: Eol
  savedEol: Eol
  encoding: string
  mtime: number
  size: number
  truncated: boolean
  saving: boolean
}

export interface SessionUI {
  /** true after the first successful connect; panes show even if the listing failed to load */
  initialized: boolean
  panes: Record<PaneId, PaneState>
  activePane: PaneId
  terminalOpen: boolean
  terminalId?: string
  /** Command the terminal runs once it opens (for example docker exec) */
  terminalCommand?: string
  dockerOpen: boolean
  docs: EditorDoc[]
  activeDocId?: string
  editorVisible: boolean
}

export type Dialog =
  | {
      kind: 'input'
      title: string
      label?: string
      initial?: string
      placeholder?: string
      okLabel?: string
      mono?: boolean
      selectEnd?: number
      validate?: (v: string) => string | null
      onSubmit: (v: string) => void | Promise<void>
    }
  | {
      kind: 'confirm'
      title: string
      message: string
      details?: string[]
      danger?: boolean
      okLabel?: string
      onConfirm: () => void | Promise<void>
    }
  | { kind: 'chmod'; sessionId: string; pane: PaneId; target: Target; entries: FileEntry[] }
  | { kind: 'properties'; target: Target; entry: FileEntry }
  | { kind: 'settings' }
  | { kind: 'sshImport' }
  | { kind: 'search'; sessionId: string; pane: PaneId }
  | { kind: 'compare'; sessionId: string }
  | { kind: 'massRename'; sessionId: string; pane: PaneId; entries: FileEntry[] }
  | { kind: 'command'; sessionId: string; title: string; cmd: string }
  | { kind: 'dockerInspect'; sessionId: string; container: DockerContainer }
  | { kind: 'about' }

export interface ClipboardState {
  sid: string
  pane: PaneId
  entries: FileEntry[]
  cut: boolean
}

interface NavigateOptions {
  history?: boolean
  keepSelection?: boolean
  keepFilter?: boolean
}

interface State {
  booted: boolean
  info: AppInfo | null
  settings: AppSettings
  profiles: Profile[]
  sessions: Record<string, SessionInfo>
  tabs: string[]
  activeTab: string
  ui: Record<string, SessionUI>
  transfers: TransferSummary
  transfersOpen: boolean
  extedits: ExternalEdit[]
  toasts: Toast[]
  prompts: PromptRequest[]
  dialog: Dialog | null
  connecting: boolean
  clipboard: ClipboardState | null
  watches: WatchInfo[]
  tunnels: Tunnel[]
}

interface Actions {
  boot(): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
  loadProfiles(): Promise<void>
  saveProfile(p: Profile, password?: string | null): Promise<Profile>
  deleteProfile(id: string): Promise<void>
  connect(req: ConnectRequest): Promise<SessionInfo | null>
  reconnect(id: string): Promise<void>
  closeTab(id: string): Promise<void>
  setActiveTab(id: string): void

  setPane(sid: string, pane: PaneId, patch: Partial<PaneState>): void
  setActivePane(sid: string, pane: PaneId): void
  navigate(sid: string, pane: PaneId, path: string, opts?: NavigateOptions): Promise<void>
  refresh(sid: string, pane: PaneId): Promise<void>
  goBack(sid: string, pane: PaneId): void
  goForward(sid: string, pane: PaneId): void
  goUp(sid: string, pane: PaneId): void
  goHome(sid: string, pane: PaneId): Promise<void>

  openDoc(sid: string, target: Target, path: string): Promise<void>
  openLog(sid: string, target: Target, path: string): Promise<void>
  updateDoc(sid: string, id: string, content: string): void
  saveDoc(sid: string, id: string, force?: boolean): Promise<boolean>
  closeDoc(sid: string, id: string, force?: boolean): void
  setActiveDoc(sid: string, id: string): void
  setEditorVisible(sid: string, visible: boolean): void

  toggleTerminal(sid: string): void
  setTerminalId(sid: string, id?: string): void
  setTerminalCommand(sid: string, cmd?: string): void
  setDockerOpen(sid: string, open: boolean): void
  openCommandLog(sid: string, tailId: string, label: string): void

  pushToast(t: Omit<Toast, 'id'> & { id?: string }): void
  dismissToast(id: string): void
  answerPrompt(id: string, answer: unknown): Promise<void>
  openDialog(d: Dialog): void
  closeDialog(): void
  setTransfersOpen(open: boolean): void
  setClipboard(c: ClipboardState | null): void
  toggleSudo(sid: string): Promise<void>
}

export type AppStore = State & Actions

const api = window.api

const THEME_BG = { dark: '#0b0f17', light: '#f3f5f9' }
const THEME_SYMBOL = { dark: '#cbd5e1', light: '#334155' }

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme
  void api.app.setTitleBarOverlay({ color: THEME_BG[theme], symbolColor: THEME_SYMBOL[theme] }).catch(() => {})
}

export function emptyPane(): PaneState {
  return {
    path: '',
    entries: [],
    loading: false,
    selected: [],
    filter: '',
    filterOpen: false,
    sortKey: 'name',
    sortDir: 'asc',
    history: [],
    historyIndex: -1
  }
}

function newSessionUI(): SessionUI {
  return {
    initialized: false,
    panes: { local: emptyPane(), remote: emptyPane() },
    activePane: 'remote',
    terminalOpen: false,
    dockerOpen: false,
    docs: [],
    editorVisible: false
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Request counters, used to ignore stale listing responses */
const navSeq = new Map<string, number>()
const refreshTimers = new Map<string, number>()

export const useApp = create<AppStore>((set, get) => ({
  booted: false,
  info: null,
  settings: DEFAULT_SETTINGS,
  profiles: [],
  sessions: {},
  tabs: [],
  activeTab: 'home',
  ui: {},
  transfers: { items: [], active: 0, totalSpeed: 0 },
  transfersOpen: false,
  extedits: [],
  toasts: [],
  prompts: [],
  dialog: null,
  connecting: false,
  clipboard: null,
  watches: [],
  tunnels: [],

  async boot() {
    if (get().booted) return
    const info = await api.app.info()
    setLocalPlatform(info.platform)
    const settings = await api.settings.get()
    applyTheme(settings.theme)
    setLang(settings.language)
    const [profiles, sessionList, transfers, extedits, watches, tunnels] = await Promise.all([
      api.profiles.list(),
      api.sessions.list(),
      api.transfer.list(),
      api.extedit.list(),
      api.watch.list().catch(() => []),
      api.tunnel.list().catch(() => [])
    ])
    const sessions: Record<string, SessionInfo> = {}
    for (const s of sessionList) sessions[s.id] = s
    set({ booted: true, info, settings, profiles, sessions, transfers, extedits, watches, tunnels })
    api.on.watchUpdate((list) => set({ watches: list }))
    api.on.tunnelUpdate((list) => set({ tunnels: list }))

    api.on.sessionUpdate((s) => onSessionUpdate(s))
    api.on.sessionReconnected((id) => {
      void get().refresh(id, 'remote')
    })
    api.on.transferUpdate((summary) => {
      const prev = get().transfers
      const prevStatus = new Map(prev.items.map((i) => [i.id, i.status]))
      const finishedSessions = new Map<string, Set<PaneId>>()
      for (const it of summary.items) {
        if (it.status === 'done' && prevStatus.get(it.id) !== 'done') {
          const pane: PaneId = it.direction === 'upload' ? 'remote' : 'local'
          if (!finishedSessions.has(it.sessionId)) finishedSessions.set(it.sessionId, new Set())
          finishedSessions.get(it.sessionId)!.add(pane)
        }
      }
      const open = get().transfersOpen || summary.items.length > prev.items.length
      set({ transfers: summary, transfersOpen: open })
      for (const [sid, panes] of finishedSessions) {
        for (const pane of panes) scheduleRefresh(sid, pane)
      }
    })
    api.on.exteditUpdate((list) => set({ extedits: list }))
    api.on.promptRequest((req) => set((s) => ({ prompts: [...s.prompts, req] })))
    api.on.toast((t) => get().pushToast(t))

    function onSessionUpdate(info: SessionInfo): void {
      const st = get()
      const isNew = !st.ui[info.id]
      set((s) => ({
        sessions: { ...s.sessions, [info.id]: info },
        ui: isNew ? { ...s.ui, [info.id]: newSessionUI() } : s.ui,
        tabs: s.tabs.includes(info.id) ? s.tabs : [...s.tabs, info.id],
        activeTab: isNew ? info.id : s.activeTab
      }))
      if (info.status === 'connected') {
        const ui = get().ui[info.id]
        if (!ui.initialized) set((s) => ({ ui: { ...s.ui, [info.id]: { ...s.ui[info.id], initialized: true } } }))
        if (!ui.panes.remote.path) {
          const remotePath = info.startRemotePath?.trim() || info.homeDir || '/'
          const localPath = info.startLocalPath?.trim() || get().info?.home || ''
          void get().navigate(info.id, 'remote', remotePath)
          void get().navigate(info.id, 'local', localPath)
        }
      }
    }

    function scheduleRefresh(sid: string, pane: PaneId): void {
      const key = `${sid}:${pane}`
      const prevTimer = refreshTimers.get(key)
      if (prevTimer) window.clearTimeout(prevTimer)
      refreshTimers.set(
        key,
        window.setTimeout(() => {
          refreshTimers.delete(key)
          void get().refresh(sid, pane)
        }, 600)
      )
    }
  },

  async updateSettings(patch) {
    const next = await api.settings.set(patch)
    if (patch.theme) applyTheme(patch.theme)
    if (patch.language) setLang(next.language)
    set({ settings: next })
  },

  async loadProfiles() {
    set({ profiles: await api.profiles.list() })
  },

  async saveProfile(p, password) {
    const saved = await api.profiles.save(p, password)
    await get().loadProfiles()
    return saved
  },

  async deleteProfile(id) {
    await api.profiles.remove(id)
    await get().loadProfiles()
  },

  async connect(req) {
    set({ connecting: true })
    try {
      const info = await api.sessions.connect(req)
      await get().loadProfiles()
      return info
    } catch (e) {
      get().pushToast({ kind: 'error', title: tr().store.connectFailed, message: errMsg(e) })
      return null
    } finally {
      set({ connecting: false })
    }
  },

  async reconnect(id) {
    try {
      await api.sessions.connect({ sessionId: id })
    } catch (e) {
      get().pushToast({ kind: 'error', title: tr().store.connectFailed, message: errMsg(e) })
    }
  },

  async closeTab(id) {
    const ui = get().ui[id]
    const dirty = ui?.docs.filter((d) => d.kind === 'text' && (d.content !== d.savedContent || d.eol !== d.savedEol)) ?? []
    const doClose = async (): Promise<void> => {
      for (const d of ui?.docs ?? []) if (d.kind === 'log' && d.tailId) void api.tail.stop(d.tailId).catch(() => {})
      await api.sessions.remove(id).catch(() => {})
      set((s) => {
        const tabs = s.tabs.filter((t) => t !== id)
        const { [id]: _removed, ...ui } = s.ui
        const { [id]: _removedSession, ...sessions } = s.sessions
        let activeTab = s.activeTab
        if (activeTab === id) {
          const idx = s.tabs.indexOf(id)
          activeTab = tabs[Math.min(idx, tabs.length - 1)] ?? 'home'
        }
        return { tabs, ui, sessions, activeTab }
      })
    }
    if (dirty.length) {
      const t = tr().store
      get().openDialog({
        kind: 'confirm',
        title: t.closeTabDirtyTitle,
        message: t.closeTabDirtyMessage,
        details: dirty.map((d) => d.name),
        danger: true,
        okLabel: t.closeWithoutSaving,
        onConfirm: doClose
      })
      return
    }
    await doClose()
  },

  setActiveTab(id) {
    set({ activeTab: id })
  },

  setPane(sid, pane, patch) {
    set((s) => {
      const ui = s.ui[sid]
      if (!ui) return {}
      return { ui: { ...s.ui, [sid]: { ...ui, panes: { ...ui.panes, [pane]: { ...ui.panes[pane], ...patch } } } } }
    })
  },

  setActivePane(sid, pane) {
    set((s) => {
      const ui = s.ui[sid]
      if (!ui || ui.activePane === pane) return {}
      return { ui: { ...s.ui, [sid]: { ...ui, activePane: pane } } }
    })
  },

  async navigate(sid, pane, path, opts = {}) {
    const target: Target = pane === 'local' ? 'local' : sid
    const lib = pathLib(target)
    let p = path.trim()
    if (pane === 'remote') {
      const home = get().sessions[sid]?.homeDir ?? '/'
      if (p === '~' || p === '') p = home
      else if (p.startsWith('~/')) p = home + p.slice(1)
    }
    p = lib.normalize(p)
    const key = `${sid}:${pane}`
    const seq = (navSeq.get(key) ?? 0) + 1
    navSeq.set(key, seq)
    get().setPane(sid, pane, { loading: true, error: undefined })
    try {
      const res = await api.fs.list(target, p)
      if (navSeq.get(key) !== seq) return
      const cur = get().ui[sid]?.panes[pane]
      if (!cur) return
      const existing = new Set(res.entries.map((e) => e.path))
      const selected = opts.keepSelection ? cur.selected.filter((x) => existing.has(x)) : []
      const cursor = opts.keepSelection && cur.cursor && existing.has(cur.cursor) ? cur.cursor : undefined
      let history = cur.history
      let historyIndex = cur.historyIndex
      if (opts.history !== false && cur.history[cur.historyIndex] !== p) {
        history = [...cur.history.slice(0, cur.historyIndex + 1), p].slice(-100)
        historyIndex = history.length - 1
      }
      get().setPane(sid, pane, {
        path: p,
        entries: res.entries,
        loading: false,
        error: undefined,
        selected,
        cursor,
        anchor: undefined,
        renaming: undefined,
        filter: opts.keepFilter ? cur.filter : '',
        filterOpen: opts.keepFilter ? cur.filterOpen : false,
        history,
        historyIndex
      })
      void api.fs
        .diskUsage(target, p)
        .then((disk) => {
          if (navSeq.get(key) === seq) get().setPane(sid, pane, { disk })
        })
        .catch(() => {})
    } catch (e) {
      if (navSeq.get(key) !== seq) return
      console.warn(`[navigate] ${pane} ${p}: ${errMsg(e)}`)
      get().setPane(sid, pane, { loading: false, error: errMsg(e) })
      const cur = get().ui[sid]?.panes[pane]
      if (cur && !cur.path) {
        // The first navigation failed: fall back to the home folder
        const fallback = pane === 'remote' ? get().sessions[sid]?.homeDir || '/' : get().info?.home || ''
        if (fallback !== p) void get().navigate(sid, pane, fallback)
      }
    }
  },

  async refresh(sid, pane) {
    const cur = get().ui[sid]?.panes[pane]
    if (!cur) return
    await get().navigate(sid, pane, cur.path, { history: false, keepSelection: true, keepFilter: true })
  },

  goBack(sid, pane) {
    const cur = get().ui[sid]?.panes[pane]
    if (!cur || cur.historyIndex <= 0) return
    const idx = cur.historyIndex - 1
    get().setPane(sid, pane, { historyIndex: idx })
    void get().navigate(sid, pane, cur.history[idx], { history: false })
  },

  goForward(sid, pane) {
    const cur = get().ui[sid]?.panes[pane]
    if (!cur || cur.historyIndex >= cur.history.length - 1) return
    const idx = cur.historyIndex + 1
    get().setPane(sid, pane, { historyIndex: idx })
    void get().navigate(sid, pane, cur.history[idx], { history: false })
  },

  goUp(sid, pane) {
    const cur = get().ui[sid]?.panes[pane]
    if (!cur) return
    const target: Target = pane === 'local' ? 'local' : sid
    const lib = pathLib(target)
    if (lib.isRoot(cur.path)) return
    const parent = lib.dirname(cur.path)
    void get()
      .navigate(sid, pane, parent)
      .then(() => {
        const next = get().ui[sid]?.panes[pane]
        if (next && next.entries.some((e) => e.path === cur.path)) {
          get().setPane(sid, pane, { cursor: cur.path, selected: [cur.path] })
        }
      })
  },

  async goHome(sid, pane) {
    const target: Target = pane === 'local' ? 'local' : sid
    const home = pane === 'local' ? get().info?.home || '' : get().sessions[sid]?.homeDir || '/'
    await get().navigate(sid, pane, home || (await api.fs.home(target)))
  },

  async openDoc(sid, target, path) {
    const ui = get().ui[sid]
    if (!ui) return
    const existing = ui.docs.find((d) => d.target === target && d.path === path)
    if (existing) {
      set((s) => ({ ui: { ...s.ui, [sid]: { ...s.ui[sid], activeDocId: existing.id, editorVisible: true } } }))
      return
    }
    try {
      const res = await api.text.open(target, path)
      const doc: EditorDoc = {
        id: uid(),
        kind: 'text',
        target,
        path,
        name: pathLib(target).basename(path),
        content: res.content,
        savedContent: res.content,
        eol: res.eol,
        savedEol: res.eol,
        encoding: res.encoding,
        mtime: res.mtime,
        size: res.size,
        truncated: res.truncated,
        saving: false
      }
      set((s) => ({
        ui: { ...s.ui, [sid]: { ...s.ui[sid], docs: [...s.ui[sid].docs, doc], activeDocId: doc.id, editorVisible: true } }
      }))
      if (res.truncated) {
        get().pushToast({ kind: 'warning', title: tr().store.fileTooLarge, message: tr().store.fileTooLargeMessage })
      }
    } catch (e) {
      get().pushToast({ kind: 'error', title: tr().store.openFileFailed, message: errMsg(e) })
    }
  },

  async openLog(sid, target, path) {
    const ui = get().ui[sid]
    if (!ui) return
    const existing = ui.docs.find((d) => d.kind === 'log' && d.target === target && d.path === path)
    if (existing) {
      set((s) => ({ ui: { ...s.ui, [sid]: { ...s.ui[sid], activeDocId: existing.id, editorVisible: true } } }))
      return
    }
    try {
      const tailId = await api.tail.start(target, path, 300)
      const doc: EditorDoc = {
        id: uid(),
        kind: 'log',
        tailId,
        target,
        path,
        name: pathLib(target).basename(path),
        content: '',
        savedContent: '',
        eol: 'LF',
        savedEol: 'LF',
        encoding: 'utf-8',
        mtime: 0,
        size: 0,
        truncated: false,
        saving: false
      }
      set((s) => ({
        ui: { ...s.ui, [sid]: { ...s.ui[sid], docs: [...s.ui[sid].docs, doc], activeDocId: doc.id, editorVisible: true } }
      }))
    } catch (e) {
      get().pushToast({ kind: 'error', title: tr().store.openLogFailed, message: errMsg(e) })
    }
  },

  updateDoc(sid, id, content) {
    set((s) => {
      const ui = s.ui[sid]
      if (!ui) return {}
      return { ui: { ...s.ui, [sid]: { ...ui, docs: ui.docs.map((d) => (d.id === id ? { ...d, content } : d)) } } }
    })
  },

  async saveDoc(sid, id, force = false) {
    const doc = get().ui[sid]?.docs.find((d) => d.id === id)
    if (!doc || doc.saving || doc.kind === 'log') return false
    if (doc.truncated) {
      get().pushToast({ kind: 'error', title: tr().store.saveDisabled, message: tr().store.saveDisabledMessage })
      return false
    }
    const patch = (p: Partial<EditorDoc>): void =>
      set((s) => {
        const ui = s.ui[sid]
        if (!ui) return {}
        return { ui: { ...s.ui, [sid]: { ...ui, docs: ui.docs.map((d) => (d.id === id ? { ...d, ...p } : d)) } } }
      })
    patch({ saving: true })
    try {
      const r = await api.text.save({
        target: doc.target,
        path: doc.path,
        content: doc.content,
        eol: doc.eol,
        encoding: doc.encoding,
        expectedMtime: doc.mtime,
        force
      })
      if (r.ok) {
        patch({ savedContent: doc.content, savedEol: doc.eol, mtime: r.mtime ?? doc.mtime, size: r.size ?? doc.size, saving: false })
        const pane: PaneId = doc.target === 'local' ? 'local' : 'remote'
        const cur = get().ui[sid]?.panes[pane]
        if (cur && pathLib(doc.target).dirname(doc.path) === cur.path) void get().refresh(sid, pane)
        return true
      }
      patch({ saving: false })
      if (r.conflict) {
        const t = tr().store
        get().openDialog({
          kind: 'confirm',
          title: t.changedExternallyTitle,
          message: t.changedExternallyMessage(doc.name),
          danger: true,
          okLabel: t.overwrite,
          onConfirm: () => void get().saveDoc(sid, id, true)
        })
        return false
      }
      get().pushToast({ kind: 'error', title: tr().store.saveFailed, message: r.error })
      return false
    } catch (e) {
      patch({ saving: false })
      get().pushToast({ kind: 'error', title: tr().store.saveFailed, message: errMsg(e) })
      return false
    }
  },

  closeDoc(sid, id, force = false) {
    const ui = get().ui[sid]
    const doc = ui?.docs.find((d) => d.id === id)
    if (!ui || !doc) return
    if (doc.kind === 'log') {
      if (doc.tailId) void api.tail.stop(doc.tailId).catch(() => {})
      force = true
    }
    if (!force && (doc.content !== doc.savedContent || doc.eol !== doc.savedEol)) {
      const t = tr()
      get().openDialog({
        kind: 'confirm',
        title: t.store.closeDocDirtyTitle,
        message: t.store.closeDocDirtyMessage(doc.name),
        danger: true,
        okLabel: t.common.close,
        onConfirm: () => get().closeDoc(sid, id, true)
      })
      return
    }
    set((s) => {
      const cur = s.ui[sid]
      const docs = cur.docs.filter((d) => d.id !== id)
      let activeDocId = cur.activeDocId
      if (activeDocId === id) {
        const idx = cur.docs.findIndex((d) => d.id === id)
        activeDocId = docs[Math.min(idx, docs.length - 1)]?.id
      }
      return { ui: { ...s.ui, [sid]: { ...cur, docs, activeDocId, editorVisible: docs.length > 0 && cur.editorVisible } } }
    })
  },

  setActiveDoc(sid, id) {
    set((s) => ({ ui: { ...s.ui, [sid]: { ...s.ui[sid], activeDocId: id, editorVisible: true } } }))
  },

  setEditorVisible(sid, visible) {
    set((s) => ({ ui: { ...s.ui, [sid]: { ...s.ui[sid], editorVisible: visible } } }))
  },

  toggleTerminal(sid) {
    set((s) => ({ ui: { ...s.ui, [sid]: { ...s.ui[sid], terminalOpen: !s.ui[sid].terminalOpen } } }))
  },

  setTerminalId(sid, id) {
    set((s) => (s.ui[sid] ? { ui: { ...s.ui, [sid]: { ...s.ui[sid], terminalId: id } } } : {}))
  },

  setTerminalCommand(sid, cmd) {
    set((s) => (s.ui[sid] ? { ui: { ...s.ui, [sid]: { ...s.ui[sid], terminalCommand: cmd } } } : {}))
  },

  setDockerOpen(sid, open) {
    set((s) => (s.ui[sid] ? { ui: { ...s.ui, [sid]: { ...s.ui[sid], dockerOpen: open, editorVisible: open ? false : s.ui[sid].editorVisible } } } : {}))
  },

  openCommandLog(sid, tailId, label) {
    const doc: EditorDoc = {
      id: uid(),
      kind: 'log',
      tailId,
      target: sid,
      path: label,
      name: label,
      content: '',
      savedContent: '',
      eol: 'LF',
      savedEol: 'LF',
      encoding: 'utf-8',
      mtime: 0,
      size: 0,
      truncated: false,
      saving: false
    }
    set((s) =>
      s.ui[sid] ? { ui: { ...s.ui, [sid]: { ...s.ui[sid], docs: [...s.ui[sid].docs, doc], activeDocId: doc.id, editorVisible: true } } } : {}
    )
  },

  pushToast(t) {
    const id = t.id ?? uid()
    set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== id), { ...t, id }] }))
    window.setTimeout(() => get().dismissToast(id), t.kind === 'error' ? 9000 : 5000)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  async answerPrompt(id, answer) {
    set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }))
    await api.prompt.answer(id, answer)
  },

  openDialog(d) {
    set({ dialog: d })
  },

  closeDialog() {
    set({ dialog: null })
  },

  setTransfersOpen(open) {
    set({ transfersOpen: open })
  },

  setClipboard(c) {
    set({ clipboard: c })
  },

  async toggleSudo(sid) {
    const s = get().sessions[sid]
    if (!s) return
    try {
      const info = await api.sessions.sudo(sid, !s.sudo)
      set((st) => ({ sessions: { ...st.sessions, [sid]: info } }))
      void get().refresh(sid, 'remote')
      const t = tr().store
      get().pushToast({
        kind: info.sudo ? 'warning' : 'info',
        title: info.sudo ? t.sudoOn : t.sudoOff,
        message: info.sudo ? t.sudoOnMessage : undefined
      })
    } catch (e) {
      get().pushToast({ kind: 'error', title: 'sudo', message: errMsg(e) })
    }
  }
}))

export function paneTarget(sid: string, pane: PaneId): Target {
  return pane === 'local' ? 'local' : sid
}

export function otherPane(pane: PaneId): PaneId {
  return pane === 'local' ? 'remote' : 'local'
}
