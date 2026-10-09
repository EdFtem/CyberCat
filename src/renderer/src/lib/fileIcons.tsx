import type { ComponentType } from 'react'
import {
  Folder,
  FolderSymlink,
  File,
  FileText,
  FileCode2,
  FileJson2,
  FileImage,
  FileArchive,
  FileAudio2,
  FileVideo2,
  FileCog,
  FileTerminal,
  FileKey2,
  FileLock2,
  FileSpreadsheet,
  FileType2,
  HardDrive,
  Database,
  BookOpen,
  type LucideProps
} from 'lucide-react'
import type { FileEntry } from '@shared/types'
import { extOf } from './format'

type Icon = ComponentType<LucideProps>

interface IconSpec {
  Icon: Icon
  color: string
}

const code = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cc',
  'cs', 'php', 'swift', 'scala', 'lua', 'pl', 'r', 'dart', 'vue', 'svelte', 'html', 'htm', 'css', 'scss', 'less',
  'sql', 'graphql'
])
const text = new Set(['txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv', 'license', 'readme'])
const config = new Set(['yml', 'yaml', 'toml', 'ini', 'conf', 'cfg', 'env', 'properties', 'xml', 'plist', 'service', 'editorconfig'])
const archive = new Set(['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'deb', 'rpm', 'jar', 'war'])
const image = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'avif', 'heic'])
const audio = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'])
const video = new Set(['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'])
const shell = new Set(['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'])
const keys = new Set(['pem', 'pub', 'key', 'crt', 'cer', 'p12', 'pfx', 'ppk', 'asc', 'gpg'])
const sheet = new Set(['xls', 'xlsx', 'ods', 'numbers'])
const doc = new Set(['pdf', 'doc', 'docx', 'odt', 'rtf', 'epub'])
const db = new Set(['db', 'sqlite', 'sqlite3', 'dump', 'bak'])
const fonts = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot'])

export function iconFor(entry: FileEntry): IconSpec {
  if (entry.isDrive) return { Icon: HardDrive, color: 'var(--text-muted)' }
  if (entry.isDir) return { Icon: entry.isSymlink ? FolderSymlink : Folder, color: 'var(--folder)' }
  const name = entry.name.toLowerCase()
  const ext = extOf(name)
  if (name === 'dockerfile' || name === 'makefile' || name === 'vagrantfile') return { Icon: FileCog, color: '#60a5fa' }
  if (name.startsWith('.') && !ext) return { Icon: FileCog, color: 'var(--text-dim)' }
  if (name === 'id_rsa' || name === 'id_ed25519' || name === 'authorized_keys' || name === 'known_hosts') {
    return { Icon: FileKey2, color: '#fbbf24' }
  }
  if (ext === 'json' || ext === 'jsonc' || ext === 'json5') return { Icon: FileJson2, color: '#facc15' }
  if (code.has(ext)) return { Icon: FileCode2, color: '#a78bfa' }
  if (shell.has(ext)) return { Icon: FileTerminal, color: '#34d399' }
  if (config.has(ext)) return { Icon: FileCog, color: '#60a5fa' }
  if (text.has(ext)) return { Icon: FileText, color: 'var(--text-muted)' }
  if (archive.has(ext)) return { Icon: FileArchive, color: '#f59e0b' }
  if (image.has(ext)) return { Icon: FileImage, color: '#f472b6' }
  if (audio.has(ext)) return { Icon: FileAudio2, color: '#2dd4bf' }
  if (video.has(ext)) return { Icon: FileVideo2, color: '#fb7185' }
  if (keys.has(ext)) return { Icon: FileLock2, color: '#fbbf24' }
  if (sheet.has(ext)) return { Icon: FileSpreadsheet, color: '#4ade80' }
  if (doc.has(ext)) return { Icon: BookOpen, color: '#f87171' }
  if (db.has(ext)) return { Icon: Database, color: '#38bdf8' }
  if (fonts.has(ext)) return { Icon: FileType2, color: 'var(--text-muted)' }
  return { Icon: File, color: 'var(--text-dim)' }
}

export function FileIcon({ entry, size = 16 }: { entry: FileEntry; size?: number }): React.JSX.Element {
  const { Icon, color } = iconFor(entry)
  return <Icon size={size} style={{ color }} strokeWidth={1.75} className="shrink-0" />
}

const binaryExt = new Set([...archive, ...image, ...audio, ...video, ...sheet, ...doc, ...db, ...fonts, 'exe', 'dll', 'so', 'bin', 'iso', 'img', 'class', 'pyc', 'o', 'a'])

export function looksBinary(name: string): boolean {
  return binaryExt.has(extOf(name))
}
