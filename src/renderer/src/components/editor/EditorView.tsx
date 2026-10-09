import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { ArrowLeft, Save, X, Laptop, Server, TriangleAlert, ScrollText } from 'lucide-react'
import { languageFor, monaco } from '@/lib/monaco'
import { useApp, type EditorDoc } from '@/store/app'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, IconButton, Spinner } from '../ui'
import { LogView } from './LogView'

export function EditorView({ sid }: { sid: string }) {
  const docs = useApp((s) => s.ui[sid]?.docs ?? [])
  const activeId = useApp((s) => s.ui[sid]?.activeDocId)
  const setActiveDoc = useApp((s) => s.setActiveDoc)
  const closeDoc = useApp((s) => s.closeDoc)
  const setEditorVisible = useApp((s) => s.setEditorVisible)
  const updateDoc = useApp((s) => s.updateDoc)
  const saveDoc = useApp((s) => s.saveDoc)
  const theme = useApp((s) => s.settings.theme)
  const doc = docs.find((d) => d.id === activeId) ?? docs[0]
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const saveRef = useRef<() => void>(() => {})

  saveRef.current = () => {
    if (doc && doc.kind === 'text') void saveDoc(sid, doc.id)
  }

  const onMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
    editor.focus()
  }, [])

  useEffect(() => {
    if (doc?.kind === 'text') editorRef.current?.focus()
  }, [doc?.id, doc?.kind])

  if (!doc) return null
  const isLog = doc.kind === 'log'
  const dirty = !isLog && (doc.content !== doc.savedContent || doc.eol !== doc.savedEol)

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-surface rounded-lg border border-border overflow-hidden">
      <div className="flex items-center h-10 border-b border-border pl-1 pr-2 gap-1">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => setEditorVisible(sid, false)} title="До файлів (Ctrl+E)">
          Файли
        </Button>
        <span className="w-px h-5 bg-border mx-1" />
        <div className="flex items-end gap-0.5 flex-1 min-w-0 h-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {docs.map((d) => (
            <DocTab key={d.id} d={d} active={d.id === doc.id} onClick={() => setActiveDoc(sid, d.id)} onClose={() => closeDoc(sid, d.id)} />
          ))}
        </div>
        {!isLog && (
          <Button
            size="sm"
            variant={dirty ? 'primary' : 'ghost'}
            icon={doc.saving ? <Spinner size={13} /> : <Save size={14} />}
            disabled={!dirty || doc.saving || doc.truncated}
            onClick={() => void saveDoc(sid, doc.id)}
            title="Зберегти (Ctrl+S)"
          >
            Зберегти
          </Button>
        )}
      </div>

      {doc.truncated && (
        <div className="flex items-center gap-2 px-3 h-8 text-[12px] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-warning border-b border-border">
          <TriangleAlert size={14} /> Файл відкрито частково (перші 8 МБ). Збереження вимкнено.
        </div>
      )}

      {isLog ? (
        <LogView key={doc.id} doc={doc} />
      ) : (
        <div className="flex-1 min-h-0">
          <Editor
            path={`cybercat://${sid}/${doc.id}/${encodeURIComponent(doc.name)}`}
            language={languageFor(doc.name)}
            value={doc.content}
            theme={theme === 'dark' ? 'cybercat-dark' : 'cybercat-light'}
            onChange={(v) => updateDoc(sid, doc.id, v ?? '')}
            onMount={onMount}
            loading={<Spinner size={22} />}
            options={{
              fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              padding: { top: 10 },
              readOnly: doc.truncated,
              bracketPairColorization: { enabled: true },
              fontLigatures: true,
              wordWrap: 'off',
              tabSize: 4
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-4 px-3 h-7 border-t border-border text-[11.5px] text-dim">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {doc.target === 'local' ? <Laptop size={12} /> : <Server size={12} />}
          <span className="truncate font-mono">{doc.path}</span>
        </span>
        <span className="flex-1" />
        {isLog ? (
          <span>живий перегляд</span>
        ) : (
          <>
            <span>{formatBytes(doc.size)}</span>
            <span className="uppercase">{doc.encoding}</span>
            <button type="button" className="hover:text-text" title="Перемкнути тип переносу рядка" onClick={() => toggleEol(sid, doc)}>
              {doc.eol}
            </button>
            <span>{languageFor(doc.name)}</span>
            {dirty && <span className="text-warning">● змінено</span>}
          </>
        )}
      </div>
    </div>
  )
}

function toggleEol(sid: string, doc: EditorDoc): void {
  const next = doc.eol === 'LF' ? 'CRLF' : 'LF'
  useApp.setState((s) => {
    const ui = s.ui[sid]
    if (!ui) return {}
    return { ui: { ...s.ui, [sid]: { ...ui, docs: ui.docs.map((d) => (d.id === doc.id ? { ...d, eol: next } : d)) } } }
  })
}

function DocTab({ d, active, onClick, onClose }: { d: EditorDoc; active: boolean; onClick: () => void; onClose: () => void }) {
  const dirty = d.kind === 'text' && (d.content !== d.savedContent || d.eol !== d.savedEol)
  return (
    <div
      role="tab"
      onClick={onClick}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          onClose()
        }
      }}
      className={cn(
        'group inline-flex items-center gap-2 h-[31px] px-3 rounded-t-md text-[12.5px] cursor-default whitespace-nowrap border border-b-0',
        active ? 'bg-surface-2 border-border text-text' : 'border-transparent text-muted hover:bg-surface-2/60 hover:text-text'
      )}
      title={d.path}
    >
      {d.kind === 'log' ? (
        <ScrollText size={12} className="text-success" />
      ) : d.target === 'local' ? (
        <Laptop size={12} className="text-dim" />
      ) : (
        <Server size={12} className="text-accent" />
      )}
      <span className="truncate max-w-[180px]">{d.name}</span>
      <IconButton
        title="Закрити"
        size={18}
        className={cn('-mr-1', !dirty && 'opacity-0 group-hover:opacity-100')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        {dirty ? <span className="inline-block h-2 w-2 rounded-full bg-warning" /> : <X size={12} />}
      </IconButton>
    </div>
  )
}
