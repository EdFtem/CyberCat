import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import { extOf } from './format'

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

monaco.editor.defineTheme('cybercat-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '647389', fontStyle: 'italic' },
    { token: 'keyword', foreground: '22d3ee' },
    { token: 'string', foreground: '86efac' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: 'a78bfa' },
    { token: 'variable', foreground: 'e6eaf0' },
    { token: 'attribute.name', foreground: '7dd3fc' },
    { token: 'tag', foreground: 'f472b6' }
  ],
  colors: {
    'editor.background': '#10161f',
    'editor.foreground': '#e6eaf0',
    'editorLineNumber.foreground': '#3f4c61',
    'editorLineNumber.activeForeground': '#9aa8bb',
    'editor.lineHighlightBackground': '#161d29',
    'editor.selectionBackground': '#22d3ee33',
    'editor.inactiveSelectionBackground': '#22d3ee1a',
    'editorCursor.foreground': '#22d3ee',
    'editorIndentGuide.background1': '#1d2635',
    'editorIndentGuide.activeBackground1': '#2f3d52',
    'editorWidget.background': '#161d29',
    'editorWidget.border': '#233042',
    'input.background': '#10161f',
    'scrollbarSlider.background': '#2a354780',
    'scrollbarSlider.hoverBackground': '#3b4961aa',
    'minimap.background': '#10161f'
  }
})

monaco.editor.defineTheme('cybercat-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8794a7', fontStyle: 'italic' },
    { token: 'keyword', foreground: '0e7490' },
    { token: 'string', foreground: '15803d' },
    { token: 'number', foreground: 'b45309' },
    { token: 'type', foreground: '6d28d9' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.lineHighlightBackground': '#f4f6fa',
    'editor.selectionBackground': '#0891b233',
    'editorCursor.foreground': '#0891b2',
    'editorLineNumber.foreground': '#aeb9c8',
    'editorLineNumber.activeForeground': '#4b5a6e'
  }
})

loader.config({ monaco })

const extMap: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',
  env: 'ini',
  properties: 'ini',
  service: 'ini',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  cmd: 'bat',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  scala: 'scala',
  lua: 'lua',
  pl: 'perl',
  r: 'r',
  dart: 'dart',
  html: 'html',
  htm: 'html',
  vue: 'html',
  svelte: 'html',
  xml: 'xml',
  svg: 'xml',
  plist: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  graphql: 'graphql',
  dockerfile: 'dockerfile',
  txt: 'plaintext',
  log: 'plaintext',
  csv: 'plaintext'
}

const nameMap: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'plaintext',
  '.bashrc': 'shell',
  '.zshrc': 'shell',
  '.profile': 'shell',
  '.bash_profile': 'shell',
  '.gitignore': 'plaintext',
  '.env': 'ini',
  'nginx.conf': 'ini',
  'sshd_config': 'ini',
  'ssh_config': 'ini'
}

export function languageFor(name: string): string {
  const lower = name.toLowerCase()
  if (nameMap[lower]) return nameMap[lower]
  const ext = extOf(lower)
  if (extMap[ext]) return extMap[ext]
  const found = monaco.languages.getLanguages().find((l) => l.extensions?.includes(`.${ext}`))
  return found?.id ?? 'plaintext'
}

export { monaco }
