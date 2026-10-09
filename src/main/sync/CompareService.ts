import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { sessions } from '../ssh/SessionManager'
import { localFs, RemoteFs } from '../fs'
import type { FsAdapter } from '../fs/types'
import { shq } from '../fs/sftpUtil'
import type { CompareEntry, CompareRequest, CompareResult, FileEntry } from '@shared/types'

const MAX_ENTRIES = 20_000
const MAX_DEPTH = 25
const MTIME_TOLERANCE_MS = 2000
const HASH_BATCH = 200

interface WalkState {
  count: number
  truncated: boolean
}

async function walk(fs: FsAdapter, root: string, out: Map<string, FileEntry>, state: WalkState, rel = '', depth = 0): Promise<void> {
  if (depth > MAX_DEPTH || state.truncated) return
  let entries: FileEntry[]
  try {
    entries = await fs.list(rel ? fs.join(root, ...rel.split('/')) : root)
  } catch {
    return
  }
  for (const e of entries) {
    if (state.count >= MAX_ENTRIES) {
      state.truncated = true
      return
    }
    const r = rel ? `${rel}/${e.name}` : e.name
    out.set(r, e)
    state.count++
    if (e.isDir && !e.isSymlink) await walk(fs, root, out, state, r, depth + 1)
  }
}

function sha256Local(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(path)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })
}

export async function runCompare(req: CompareRequest): Promise<CompareResult> {
  const session = sessions.require(req.sessionId)
  const remote = new RemoteFs(session)
  const L = new Map<string, FileEntry>()
  const R = new Map<string, FileEntry>()
  const sL: WalkState = { count: 0, truncated: false }
  const sR: WalkState = { count: 0, truncated: false }
  await Promise.all([walk(localFs, req.localDir, L, sL), walk(remote, req.remoteDir, R, sR)])

  const entries: CompareEntry[] = []
  const counts = { onlyLocal: 0, onlyRemote: 0, different: 0, same: 0 }
  const hashCandidates: string[] = []
  const side = (e: FileEntry): { size: number; mtime: number } => ({ size: e.size, mtime: e.mtime })

  for (const k of [...new Set([...L.keys(), ...R.keys()])].sort()) {
    const l = L.get(k)
    const r = R.get(k)
    if (l && !r) {
      counts.onlyLocal++
      entries.push({ rel: k, kind: l.isDir ? 'dir' : 'file', status: 'only-local', local: side(l) })
    } else if (!l && r) {
      counts.onlyRemote++
      entries.push({ rel: k, kind: r.isDir ? 'dir' : 'file', status: 'only-remote', remote: side(r) })
    } else if (l && r) {
      if (l.isDir !== r.isDir) {
        counts.different++
        entries.push({ rel: k, kind: 'file', status: 'different', reason: 'type', local: side(l), remote: side(r) })
      } else if (l.isDir) {
        continue
      } else if (l.size !== r.size) {
        counts.different++
        entries.push({ rel: k, kind: 'file', status: 'different', reason: 'size', newer: l.mtime >= r.mtime ? 'local' : 'remote', local: side(l), remote: side(r) })
      } else if (req.byHash && session.info.hasShell) {
        hashCandidates.push(k)
      } else if (Math.abs(l.mtime - r.mtime) > MTIME_TOLERANCE_MS) {
        counts.different++
        entries.push({ rel: k, kind: 'file', status: 'different', reason: 'mtime', newer: l.mtime > r.mtime ? 'local' : 'remote', local: side(l), remote: side(r) })
      } else {
        counts.same++
      }
    }
  }

  let hashed = false
  if (hashCandidates.length) {
    hashed = true
    for (let i = 0; i < hashCandidates.length; i += HASH_BATCH) {
      const chunk = hashCandidates.slice(i, i + HASH_BATCH)
      const loop = chunk.map((rel) => shq(rel)).join(' ')
      const r = await session.exec(`cd ${shq(req.remoteDir)} && for f in ${loop}; do sha256sum -- "$f" 2>/dev/null || echo "- -"; done`, 600_000)
      const lines = r.stdout.split('\n').filter((x) => x.length)
      for (let j = 0; j < chunk.length; j++) {
        const rel = chunk[j]
        const remoteHash = lines[j]?.split(/\s+/)[0] ?? '-'
        let localHash = '?'
        try {
          localHash = await sha256Local(localFs.join(req.localDir, ...rel.split('/')))
        } catch {
          /* нечитабельний файл */
        }
        const l = L.get(rel)!
        const rr = R.get(rel)!
        if (remoteHash !== '-' && remoteHash === localHash) counts.same++
        else {
          counts.different++
          entries.push({ rel, kind: 'file', status: 'different', reason: 'hash', newer: l.mtime >= rr.mtime ? 'local' : 'remote', local: side(l), remote: side(rr) })
        }
      }
    }
    entries.sort((a, b) => a.rel.localeCompare(b.rel))
  }

  return { entries, truncated: sL.truncated || sR.truncated, counts, hashed }
}
