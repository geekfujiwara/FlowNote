import React from 'react'
import { useStore } from '@/store/useStore'
import {
  Save,
  Undo2,
  Redo2,
  Code2,
  Type,
  AlignLeft,
  Loader2,
  FileText,
  Download,
} from 'lucide-react'

interface Props {
  onUndo?: () => void
  onRedo?: () => void
  onExport?: () => void
}

export function EditorToolbar({ onUndo, onRedo, onExport }: Props) {
  const saveNote = useStore((s) => s.saveNote)
  const isSaving = useStore((s) => s.isSaving)
  const currentNote = useStore((s) => s.currentNote)
  const setMarkdown = useStore((s) => s.setMarkdown)
  const markdown = useStore((s) => s.markdown)

  const insertFlowBlock = () => {
    const block = '\n```flow\n[[start]] 開始\n[step] ステップ\n((end)) 終了\n\n[[start]] -> [step]\n[step] -> ((end))\n```\n'
    setMarkdown(markdown + block, 'user')
  }

  const insertHeading = () => {
    setMarkdown(markdown.trimEnd() + '\n\n# 新しい見出し\n', 'user')
  }

  const formatMarkdown = () => {
    // Simple normalization: trim extra blank lines
    const formatted = markdown.replace(/\n{3,}/g, '\n\n').trim() + '\n'
    setMarkdown(formatted, 'user')
  }

  const disabled = !currentNote

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
      {/* Panel label */}
      <div className="flex items-center gap-1.5 mr-2 text-xs font-medium text-zinc-400">
        <FileText className="w-3.5 h-3.5 text-indigo-400" />
        <span>Markdown</span>
      </div>

      <div className="h-4 w-px bg-zinc-700 mx-1" />

      {/* Save */}
      <ToolbarButton
        icon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        title="保存 (Ctrl+S)"
        onClick={saveNote}
        disabled={disabled || isSaving}
      />

      <div className="h-4 w-px bg-zinc-700 mx-1" />

      {/* Undo / Redo */}
      <ToolbarButton icon={<Undo2 className="w-3.5 h-3.5" />} title="元に戻す (Ctrl+Z)" onClick={onUndo ?? (() => {})} disabled={disabled || !onUndo} />
      <ToolbarButton icon={<Redo2 className="w-3.5 h-3.5" />} title="やり直し (Ctrl+Y)" onClick={onRedo ?? (() => {})} disabled={disabled || !onRedo} />

      <div className="h-4 w-px bg-zinc-700 mx-1" />

      {/* Insert helpers */}
      <ToolbarButton
        icon={<Code2 className="w-3.5 h-3.5" />}
        title="フローブロックを挿入"
        onClick={insertFlowBlock}
        disabled={disabled}
      />
      <ToolbarButton
        icon={<Type className="w-3.5 h-3.5" />}
        title="見出しを挿入"
        onClick={insertHeading}
        disabled={disabled}
      />
      <ToolbarButton
        icon={<AlignLeft className="w-3.5 h-3.5" />}
        title="フォーマット"
        onClick={formatMarkdown}
        disabled={disabled}
      />

      <div className="h-4 w-px bg-zinc-700 mx-1" />

      {/* Export */}
      <ToolbarButton
        icon={<Download className="w-3.5 h-3.5" />}
        title="Markdownをエクスポート"
        onClick={onExport ?? (() => {})}
        disabled={disabled || !onExport}
      />
    </div>
  )
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}

function ToolbarButton({ icon, title, onClick, disabled }: ToolbarButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
    </button>
  )
}
