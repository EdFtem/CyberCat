/** Робота зі шляхами у renderer: POSIX для сервера, win32 або POSIX для локальної ФС */

export interface PathLib {
  sep: string
  join(base: string, ...parts: string[]): string
  dirname(p: string): string
  basename(p: string): string
  normalize(p: string): string
  isRoot(p: string): boolean
  segments(p: string): { label: string; path: string }[]
}

export const posixPath: PathLib = {
  sep: '/',
  join(base, ...parts) {
    let out = base
    for (const p of parts) {
      if (!p) continue
      if (p.startsWith('/')) out = p
      else out = out.endsWith('/') ? out + p : `${out}/${p}`
    }
    return posixPath.normalize(out)
  },
  dirname(p) {
    const n = posixPath.normalize(p)
    if (n === '/') return '/'
    const i = n.lastIndexOf('/')
    return i <= 0 ? '/' : n.slice(0, i)
  },
  basename(p) {
    const n = posixPath.normalize(p)
    if (n === '/') return '/'
    return n.slice(n.lastIndexOf('/') + 1)
  },
  normalize(p) {
    if (!p) return '/'
    const abs = p.startsWith('/')
    const parts: string[] = []
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue
      if (seg === '..') {
        parts.pop()
        continue
      }
      parts.push(seg)
    }
    const joined = parts.join('/')
    return abs ? `/${joined}` : joined || '/'
  },
  isRoot(p) {
    return posixPath.normalize(p) === '/'
  },
  segments(p) {
    const n = posixPath.normalize(p)
    const out = [{ label: '/', path: '/' }]
    if (n === '/') return out
    let acc = ''
    for (const seg of n.split('/').filter(Boolean)) {
      acc += `/${seg}`
      out.push({ label: seg, path: acc })
    }
    return out
  }
}

export const winPath: PathLib = {
  sep: '\\',
  join(base, ...parts) {
    let out = base
    for (const p of parts) {
      if (!p) continue
      if (/^[a-zA-Z]:[\\/]?/.test(p) || p.startsWith('\\\\')) out = p
      else out = out.endsWith('\\') || out === '' ? out + p : `${out}\\${p}`
    }
    return winPath.normalize(out)
  },
  dirname(p) {
    const n = winPath.normalize(p)
    if (n === '' || /^[a-zA-Z]:\\$/.test(n)) return ''
    const i = n.lastIndexOf('\\')
    if (i < 0) return ''
    const head = n.slice(0, i)
    return /^[a-zA-Z]:$/.test(head) ? `${head}\\` : head
  },
  basename(p) {
    const n = winPath.normalize(p)
    if (/^[a-zA-Z]:\\$/.test(n)) return n.slice(0, 2)
    return n.slice(n.lastIndexOf('\\') + 1)
  },
  normalize(p) {
    if (!p || p === '/' || p === '\\') return ''
    let s = p.replace(/\//g, '\\')
    const unc = s.startsWith('\\\\')
    const drive = /^[a-zA-Z]:/.exec(s)?.[0] ?? ''
    s = s.slice(drive.length)
    const parts: string[] = []
    for (const seg of s.split('\\')) {
      if (!seg || seg === '.') continue
      if (seg === '..') {
        parts.pop()
        continue
      }
      parts.push(seg)
    }
    if (drive) return parts.length ? `${drive.toUpperCase()}\\${parts.join('\\')}` : `${drive.toUpperCase()}\\`
    if (unc) return `\\\\${parts.join('\\')}`
    return parts.join('\\')
  },
  isRoot(p) {
    return winPath.normalize(p) === ''
  },
  segments(p) {
    const n = winPath.normalize(p)
    const out = [{ label: 'Цей ПК', path: '' }]
    if (n === '') return out
    const drive = /^[a-zA-Z]:/.exec(n)?.[0]
    if (drive) {
      out.push({ label: drive, path: `${drive}\\` })
      let acc = `${drive}\\`
      for (const seg of n.slice(3).split('\\').filter(Boolean)) {
        acc = acc.endsWith('\\') ? acc + seg : `${acc}\\${seg}`
        out.push({ label: seg, path: acc })
      }
      return out
    }
    let acc = ''
    for (const seg of n.split('\\').filter(Boolean)) {
      acc = acc ? `${acc}\\${seg}` : `\\\\${seg}`
      out.push({ label: seg, path: acc })
    }
    return out
  }
}

let localIsWin = navigator.userAgent.includes('Windows')
export function setLocalPlatform(platform: string): void {
  localIsWin = platform === 'win32'
}

export function pathLib(target: 'local' | string): PathLib {
  if (target === 'local') return localIsWin ? winPath : posixPath
  return posixPath
}

export function isLocalWin(): boolean {
  return localIsWin
}
