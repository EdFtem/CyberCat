import { useApp, paneTarget, otherPane, type PaneId, type PaneState } from '@/store/app'
import { pathLib } from './paths'
import { looksBinary } from './fileIcons'
import { countLabel } from './format'
import type { FileEntry, Toast } from '@shared/types'

const api = window.api
const S = (): ReturnType<typeof useApp.getState> => useApp.getState()

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function toast(kind: Toast['kind'], title: string, message?: string): void {
  S().pushToast({ kind, title, message })
}

export function selectedEntries(pane: PaneState): FileEntry[] {
  if (!pane.selected.length) return []
  const set = new Set(pane.selected)
  return pane.entries.filter((e) => set.has(e.path))
}

function validateName(v: string): string | null {
  const t = v.trim()
  if (!t) return 'Введіть назву'
  if (t === '.' || t === '..') return 'Неприпустима назва'
  if (/[/\\]/.test(t)) return 'Назва не може містити / або \\'
  return null
}

export const ops = {
  openEntry(sid: string, pane: PaneId, entry: FileEntry): void {
    if (entry.isDir) {
      void S().navigate(sid, pane, entry.path)
      return
    }
    const target = paneTarget(sid, pane)
    if (looksBinary(entry.name)) {
      if (pane === 'local') {
        void api.app.openPath(entry.path).catch((e) => toast('error', 'Не вдалося відкрити', errMsg(e)))
        return
      }
      S().openDialog({
        kind: 'confirm',
        title: 'Схоже, це не текстовий файл',
        message: `${entry.name} навряд чи є текстом. Відкрити у редакторі все одно?`,
        okLabel: 'Відкрити',
        onConfirm: () => S().openDoc(sid, target, entry.path)
      })
      return
    }
    void S().openDoc(sid, target, entry.path)
  },

  editInternal(sid: string, pane: PaneId, entry: FileEntry): void {
    if (entry.isDir) return
    void S().openDoc(sid, paneTarget(sid, pane), entry.path)
  },

  editExternal(sid: string, pane: PaneId, entry: FileEntry): void {
    if (entry.isDir) return
    if (pane === 'local') {
      void api.app.openPath(entry.path).catch((e) => toast('error', 'Не вдалося відкрити', errMsg(e)))
      return
    }
    api.extedit.open(sid, entry.path).catch((e) => toast('error', 'Зовнішній редактор', errMsg(e)))
  },

  mkdir(sid: string, pane: PaneId): void {
    const target = paneTarget(sid, pane)
    const cur = S().ui[sid]?.panes[pane]
    if (!cur) return
    S().openDialog({
      kind: 'input',
      title: 'Нова тека',
      label: 'Назва теки',
      placeholder: 'нова-тека',
      okLabel: 'Створити',
      validate: validateName,
      onSubmit: async (name) => {
        const full = pathLib(target).join(cur.path, name.trim())
        try {
          await api.fs.mkdir(target, full)
          await S().refresh(sid, pane)
          S().setPane(sid, pane, { selected: [full], cursor: full })
        } catch (e) {
          toast('error', 'Не вдалося створити теку', errMsg(e))
        }
      }
    })
  },

  createFile(sid: string, pane: PaneId): void {
    const target = paneTarget(sid, pane)
    const cur = S().ui[sid]?.panes[pane]
    if (!cur) return
    S().openDialog({
      kind: 'input',
      title: 'Новий файл',
      label: 'Назва файлу',
      placeholder: 'notes.txt',
      okLabel: 'Створити',
      validate: validateName,
      onSubmit: async (name) => {
        const full = pathLib(target).join(cur.path, name.trim())
        try {
          await api.fs.createFile(target, full)
          await S().refresh(sid, pane)
          S().setPane(sid, pane, { selected: [full], cursor: full })
          void S().openDoc(sid, target, full)
        } catch (e) {
          toast('error', 'Не вдалося створити файл', errMsg(e))
        }
      }
    })
  },

  async rename(sid: string, pane: PaneId, entry: FileEntry, newName: string): Promise<boolean> {
    const target = paneTarget(sid, pane)
    const name = newName.trim()
    const err = validateName(name)
    if (err) {
      toast('error', 'Перейменування', err)
      return false
    }
    if (name === entry.name) return true
    const lib = pathLib(target)
    const to = lib.join(lib.dirname(entry.path), name)
    try {
      await api.fs.rename(target, entry.path, to)
      await S().refresh(sid, pane)
      S().setPane(sid, pane, { selected: [to], cursor: to })
      return true
    } catch (e) {
      toast('error', 'Не вдалося перейменувати', errMsg(e))
      return false
    }
  },

  moveTo(sid: string, pane: PaneId, entries: FileEntry[]): void {
    if (!entries.length) return
    const target = paneTarget(sid, pane)
    const cur = S().ui[sid]?.panes[pane]
    if (!cur) return
    const lib = pathLib(target)
    S().openDialog({
      kind: 'input',
      title: entries.length === 1 ? `Перемістити ${entries[0].name}` : `Перемістити ${countLabel(entries.length, 'елемент', 'елементи', 'елементів')}`,
      label: 'Тека призначення',
      initial: cur.path,
      mono: true,
      okLabel: 'Перемістити',
      onSubmit: async (dest) => {
        const destDir = lib.normalize(dest.trim())
        const errors: string[] = []
        for (const e of entries) {
          try {
            await api.fs.rename(target, e.path, lib.join(destDir, e.name))
          } catch (err) {
            errors.push(`${e.name}: ${errMsg(err)}`)
          }
        }
        await S().refresh(sid, pane)
        if (errors.length) toast('error', 'Не все вдалося перемістити', errors.join('\n'))
        else toast('success', 'Переміщено', `${countLabel(entries.length, 'елемент', 'елементи', 'елементів')} у ${destDir}`)
      }
    })
  },

  deleteEntries(sid: string, pane: PaneId, entries: FileEntry[]): void {
    if (!entries.length) return
    const target = paneTarget(sid, pane)
    const run = async (): Promise<void> => {
      try {
        await api.fs.remove(
          target,
          entries.map((e) => ({ path: e.path, isDir: e.isDir && !e.isSymlink }))
        )
        toast('success', 'Видалено', countLabel(entries.length, 'елемент', 'елементи', 'елементів'))
      } catch (e) {
        toast('error', 'Не все вдалося видалити', errMsg(e))
      }
      await S().refresh(sid, pane)
    }
    if (!S().settings.confirmDelete) {
      void run()
      return
    }
    const hasDirs = entries.some((e) => e.isDir && !e.isSymlink)
    S().openDialog({
      kind: 'confirm',
      title: entries.length === 1 ? `Видалити ${entries[0].name}?` : `Видалити ${countLabel(entries.length, 'елемент', 'елементи', 'елементів')}?`,
      message: hasDirs
        ? 'Теки буде видалено разом з усім вмістом. Цю дію неможливо скасувати.'
        : 'Цю дію неможливо скасувати.',
      details: entries.length > 1 ? entries.slice(0, 8).map((e) => e.name).concat(entries.length > 8 ? [`… ще ${entries.length - 8}`] : []) : undefined,
      danger: true,
      okLabel: 'Видалити',
      onConfirm: run
    })
  },

  chmod(sid: string, pane: PaneId, entries: FileEntry[]): void {
    if (!entries.length) return
    S().openDialog({ kind: 'chmod', sessionId: sid, pane, target: paneTarget(sid, pane), entries })
  },

  properties(sid: string, pane: PaneId, entry: FileEntry): void {
    S().openDialog({ kind: 'properties', target: paneTarget(sid, pane), entry })
  },

  /** Копіювання між панелями: з локальної на сервер або навпаки */
  transfer(sid: string, fromPane: PaneId, entries: FileEntry[], destDir?: string): void {
    if (!entries.length) return
    const ui = S().ui[sid]
    if (!ui) return
    const dest = destDir ?? ui.panes[otherPane(fromPane)].path
    if (!dest && fromPane === 'remote') {
      toast('warning', 'Оберіть локальну теку', 'У локальній панелі відкрито список дисків.')
      return
    }
    const direction = fromPane === 'local' ? 'upload' : 'download'
    const sources = entries.filter((e) => !e.isDrive).map((e) => ({ path: e.path, name: e.name, isDir: e.isDir }))
    api.transfer
      .enqueue({ sessionId: sid, direction, sources, destDir: dest })
      .catch((e) => toast('error', 'Не вдалося почати передачу', errMsg(e)))
  },

  /** Файли, перетягнуті з Провідника */
  async uploadOsFiles(sid: string, files: File[], destDir: string): Promise<void> {
    const sources: { path: string; name: string; isDir: boolean }[] = []
    for (const f of files) {
      let p = ''
      try {
        p = api.app.getPathForFile(f)
      } catch {
        p = ''
      }
      if (!p) continue
      try {
        const st = await api.fs.stat('local', p)
        sources.push({ path: p, name: st.name, isDir: st.isDir })
      } catch {
        /* пропускаємо */
      }
    }
    if (!sources.length) return
    api.transfer
      .enqueue({ sessionId: sid, direction: 'upload', sources, destDir })
      .catch((e) => toast('error', 'Не вдалося почати передачу', errMsg(e)))
  },

  copyPath(entries: FileEntry[]): void {
    if (!entries.length) return
    void navigator.clipboard.writeText(entries.map((e) => e.path).join('\n'))
    toast('info', 'Шлях скопійовано', entries.length === 1 ? entries[0].path : countLabel(entries.length, 'шлях', 'шляхи', 'шляхів'))
  },

  openTerminalHere(sid: string, path?: string): void {
    const ui = S().ui[sid]
    if (!ui) return
    const cwd = path ?? ui.panes.remote.path
    if (ui.terminalOpen && ui.terminalId) {
      api.terminal.write(ui.terminalId, ` cd '${cwd.replace(/'/g, `'\\''`)}'\n`)
      return
    }
    if (!ui.terminalOpen) S().toggleTerminal(sid)
  },

  revealLocal(entry: FileEntry): void {
    void api.app.showInFolder(entry.path)
  }
}
