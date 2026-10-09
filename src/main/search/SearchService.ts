import { posix } from 'path'
import { sessions } from '../ssh/SessionManager'
import type { Session } from '../ssh/Session'
import { getFs, RemoteFs } from '../fs'
import type { FsAdapter } from '../fs/types'
import { shq } from '../fs/sftpUtil'
import { tr } from '../i18n'
import { globToRegExp } from '../ssh/sshConfig'
import type { FileEntry, SearchHit, SearchRequest, SearchResponse } from '@shared/types'

const DEFAULT_MAX = 500
const HARD_MAX = 5000
const MAX_DEPTH = 15
const MAX_DIRS = 20_000
const CONTENT_MAX_BYTES = 4 * 1024 * 1024
const STAT_CONCURRENCY = 16

function globify(name: string): string {
  return /[*?]/.test(name) ? name : `*${name}*`
}

function placeholderEntry(path: string, sep: string): FileEntry {
  const i = path.lastIndexOf(sep)
  return { name: i >= 0 ? path.slice(i + 1) : path, path, isDir: false, isSymlink: false, size: 0, mtime: 0, mode: 0 }
}

export async function runSearch(req: SearchRequest): Promise<SearchResponse> {
  const max = Math.min(HARD_MAX, Math.max(1, req.maxResults ?? DEFAULT_MAX))
  const name = req.name?.trim() || undefined
  const content = req.content && req.content.length ? req.content : undefined
  if (!name && !content) throw new Error(tr().main.search.nothingToFind)
  if (!req.root) throw new Error(tr().main.search.noFolder)

  if (req.target !== 'local') {
    const session = sessions.require(req.target)
    if (session.info.hasShell) return shellSearch(session, req, name, content, max)
    const r = await walkSearch(getFs(req.target), req, name, content, max)
    if (content) r.warning = tr().main.search.sftpContentWarning
    return r
  }
  return walkSearch(getFs('local'), req, name, content, max)
}

async function shellSearch(session: Session, req: SearchRequest, name: string | undefined, content: string | undefined, max: number): Promise<SearchResponse> {
  const root = shq(req.root)
  const ci = !req.caseSensitive
  const namePart = name ? `-${ci ? 'i' : ''}name ${shq(globify(name))}` : ''
  let cmd: string
  if (content) {
    cmd = `find ${root} -type f ${namePart} -print0 2>/dev/null | xargs -0 -r grep -HInsF -m1 ${ci ? '-i' : ''} -e ${shq(content)} -- 2>/dev/null | head -n ${max + 1}`
  } else {
    cmd = `find ${root} -mindepth 1 ${namePart} -print 2>/dev/null | head -n ${max + 1}`
  }
  const r = await session.exec(cmd, 180_000)
  const lines = r.stdout.split('\n').filter((l) => l.length > 0)
  const truncated = lines.length > max
  const use = lines.slice(0, max)

  const parsed: { path: string; line?: number; text?: string }[] = use.map((l) => {
    if (!content) return { path: l }
    const m = /^(.*?):(\d+):(.*)$/.exec(l)
    if (!m) return { path: l }
    return { path: m[1], line: Number(m[2]), text: m[3].trim().slice(0, 300) }
  })

  const remote = new RemoteFs(session)
  const hits: SearchHit[] = new Array(parsed.length)
  for (let i = 0; i < parsed.length; i += STAT_CONCURRENCY) {
    await Promise.all(
      parsed.slice(i, i + STAT_CONCURRENCY).map(async (p, j) => {
        let entry: FileEntry
        try {
          entry = await remote.stat(p.path)
        } catch {
          entry = placeholderEntry(p.path, '/')
        }
        entry.name = posix.basename(p.path)
        hits[i + j] = { entry, line: p.line, text: p.text }
      })
    )
  }
  return { hits, truncated, method: 'shell' }
}

function findLine(text: string, needle: string, caseSensitive: boolean): { line: number; text: string } | null {
  const hay = caseSensitive ? text : text.toLowerCase()
  const idx = hay.indexOf(caseSensitive ? needle : needle.toLowerCase())
  if (idx < 0) return null
  let line = 1
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) line++
  const start = text.lastIndexOf('\n', idx) + 1
  let end = text.indexOf('\n', idx)
  if (end < 0) end = text.length
  return { line, text: text.slice(start, end).trim().slice(0, 300) }
}

async function walkSearch(fs: FsAdapter, req: SearchRequest, name: string | undefined, content: string | undefined, max: number): Promise<SearchResponse> {
  const matcher = name ? globToRegExp(globify(name), !!req.caseSensitive) : null
  const hits: SearchHit[] = []
  let visited = 0
  let truncated = false

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (hits.length >= max) {
      truncated = true
      return
    }
    if (depth > MAX_DEPTH || visited > MAX_DIRS) return
    let entries: FileEntry[]
    try {
      entries = await fs.list(dir)
    } catch {
      return
    }
    visited++
    for (const e of entries) {
      if (hits.length >= max) {
        truncated = true
        return
      }
      const nameOk = !matcher || matcher.test(e.name)
      if (content) {
        if (!e.isDir && nameOk && e.size <= CONTENT_MAX_BYTES) {
          try {
            const { data } = await fs.readFile(e.path, CONTENT_MAX_BYTES)
            const head = data.subarray(0, 8192)
            if (!head.includes(0)) {
              const found = findLine(data.toString('utf8'), content, !!req.caseSensitive)
              if (found) hits.push({ entry: e, line: found.line, text: found.text })
            }
          } catch {
            /* skip unreadable files */
          }
        }
      } else if (nameOk) {
        hits.push({ entry: e })
      }
      if (e.isDir && !e.isSymlink && !e.isDrive) await walk(e.path, depth + 1)
    }
  }

  await walk(req.root, 0)
  return { hits, truncated, method: 'walk' }
}
