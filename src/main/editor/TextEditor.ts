import * as iconv from 'iconv-lite'
import { getFs } from '../fs'
import { tr } from '../i18n'
import type { Eol, OpenTextResult, SaveTextRequest, SaveTextResult, Target } from '@shared/types'

/** Maximum file size for the built-in editor */
export const MAX_EDITOR_BYTES = 8 * 1024 * 1024

const utf8Fatal = new TextDecoder('utf-8', { fatal: true })

function decode(buf: Buffer): { text: string; encoding: string } {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'utf-8-bom' }
  }
  try {
    return { text: utf8Fatal.decode(buf), encoding: 'utf-8' }
  } catch {
    return { text: iconv.decode(buf, 'win1251'), encoding: 'windows-1251' }
  }
}

function encode(text: string, encoding: string): Buffer {
  if (encoding === 'windows-1251') return iconv.encode(text, 'win1251')
  const body = Buffer.from(text, 'utf8')
  if (encoding === 'utf-8-bom') return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
  return body
}

function detectEol(text: string): Eol {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length
  if (crlf === 0 && lf === 0) return process.platform === 'win32' ? 'CRLF' : 'LF'
  return crlf > lf ? 'CRLF' : 'LF'
}

function sameSecond(a: number, b: number): boolean {
  return Math.floor(a / 1000) === Math.floor(b / 1000)
}

export async function openText(target: Target, path: string): Promise<OpenTextResult> {
  const fs = getFs(target)
  const st = await fs.stat(path)
  if (st.isDir) throw new Error(tr().main.fs.isFolder)
  const { data, truncated } = await fs.readFile(path, MAX_EDITOR_BYTES)
  const { text, encoding } = decode(data)
  return {
    path,
    content: text,
    encoding,
    eol: detectEol(text),
    mtime: st.mtime,
    size: st.size,
    mode: st.mode,
    truncated
  }
}

export async function saveText(req: SaveTextRequest): Promise<SaveTextResult> {
  const fs = getFs(req.target)
  let current: { mtime: number } | null = null
  try {
    current = await fs.stat(req.path)
  } catch {
    current = null
  }
  if (current && req.expectedMtime !== undefined && !req.force && !sameSecond(current.mtime, req.expectedMtime)) {
    return { ok: false, conflict: true, currentMtime: current.mtime }
  }
  const eol = req.eol === 'CRLF' ? '\r\n' : '\n'
  const normalized = req.content.replace(/\r\n|\r|\n/g, eol)
  const data = encode(normalized, req.encoding)
  try {
    await fs.writeFileAtomic(req.path, data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const st = await fs.stat(req.path)
  return { ok: true, mtime: st.mtime, size: st.size }
}
