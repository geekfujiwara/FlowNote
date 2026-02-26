import React, { useCallback, useEffect, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { undo, redo } from '@codemirror/commands'
import { useStore } from '@/store/useStore'
import { EditorToolbar } from './EditorToolbar'

export function MarkdownEditor() {
  const mdValue   = useStore((s) => s.markdown)
  const setMarkdown = useStore((s) => s.setMarkdown)
  const saveNote  = useStore((s) => s.saveNote)
  const currentNote = useStore((s) => s.currentNote)

  const cmRef = useRef<ReactCodeMirrorRef>(null)

  const handleChange = useCallback(
    (val: string) => { setMarkdown(val, 'user') },
    [setMarkdown]
  )

  // ── Ctrl+S global shortcut ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveNote()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveNote])

  // ── Undo / Redo via CodeMirror commands ─────────────────
  const handleUndo = useCallback(() => {
    const view = cmRef.current?.view
    if (view) undo(view)
  }, [])

  const handleRedo = useCallback(() => {
    const view = cmRef.current?.view
    if (view) redo(view)
  }, [])

  // ── Export as .md file ──────────────────────────────────
  const handleExport = useCallback(() => {
    const filename = (currentNote?.title ?? 'note').replace(/[/\\:*?"<>|]/g, '_') + '.md'
    const blob = new Blob([mdValue], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [mdValue, currentNote])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <EditorToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
      />

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        {currentNote ? (
          <CodeMirror
            ref={cmRef}
            value={mdValue}
            height="100%"
            theme={oneDark}
            extensions={[markdown()]}
            onChange={handleChange}
            className="h-full text-sm"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              indentOnInput: true,
              bracketMatching: true,
              autocompletion: true,
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-600">
            <div className="text-4xl">📝</div>
            <p className="text-sm">ノートを選択してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
