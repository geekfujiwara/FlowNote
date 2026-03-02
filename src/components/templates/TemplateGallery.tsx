import React, { useState } from 'react'
import { X, LayoutTemplate, Bot, ChevronRight, Sparkles, FilePlus2, ReplaceAll } from 'lucide-react'
import { TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templates'
import { useStore } from '@/store/useStore'
import type { FlowTemplate } from '@/types'

interface Props {
  onClose: () => void
  /**
   * Called when user selects a prompt suggestion.
   * The current flow is NOT overwritten – the prompt runs on the existing flow.
   */
  onRunPrompt?: (templateId: string, prompt: string) => void
  /** Shows a "空白から作成" button in the footer */
  onBlankCreate?: () => void
}

export function TemplateGallery({ onClose, onRunPrompt, onBlankCreate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<FlowTemplate | null>(null)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const activeTemplateId = useStore((s) => s.activeTemplateId)

  const filtered = selectedCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === selectedCategory)

  /** Overwrite the current flow with the template's initial markdown */
  const handleOverwrite = (template: FlowTemplate) => {
    applyTemplate(template.id)
    onClose()
  }

  /** Run a prompt suggestion on the CURRENT flow (no template overwrite) */
  const handleRunPrompt = (template: FlowTemplate, suggestionIndex = 0) => {
    onClose()
    onRunPrompt?.(template.id, template.userPromptSuggestions[suggestionIndex])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/70 backdrop-blur-sm">
      <div className="m-auto w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <LayoutTemplate className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">デザインテンプレート</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              プロンプト例を選ぶと現在のフローを保ったままAI実行 — 「テンプレートで上書き」でフローを置き換え
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            title="閉じる"
            className="ml-auto p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* ── Left: Category sidebar ──────────────────────── */}
          <nav className="w-40 shrink-0 border-r border-zinc-800 bg-zinc-900/60 py-4 flex flex-col gap-1 px-2">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {cat.label}
                <span className="ml-1.5 text-[11px] opacity-60">
                  {cat.id === 'all'
                    ? TEMPLATES.length
                    : TEMPLATES.filter((t) => t.category === cat.id).length}
                </span>
              </button>
            ))}
          </nav>

          {/* ── Right: Cards + Preview ──────────────────────── */}
          <div className="flex flex-1 min-w-0 overflow-hidden">
            {/* Card grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isActive={template.id === activeTemplateId}
                  isHovered={hoveredId === template.id}
                  onMouseEnter={() => setHoveredId(template.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onPreview={() => setPreviewTemplate(template)}
                  onOverwrite={() => handleOverwrite(template)}
                />
              ))}
            </div>

            {/* Detail preview pane */}
            {previewTemplate && (
              <div className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
                <TemplateDetail
                  template={previewTemplate}
                  onClose={() => setPreviewTemplate(null)}
                  onOverwrite={() => handleOverwrite(previewTemplate)}
                  onRunPrompt={(i) => handleRunPrompt(previewTemplate, i)}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: blank create ──────────────────────────── */}
        {onBlankCreate && (
          <div className="border-t border-zinc-800 px-6 py-3 bg-zinc-900/50 flex items-center justify-between shrink-0">
            <p className="text-xs text-zinc-500">テンプレートを使わずに空白のフローを作成</p>
            <button
              onClick={() => { onBlankCreate(); onClose() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              空白から作成
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Template Card
// ─────────────────────────────────────────────────────────────

interface CardProps {
  template: FlowTemplate
  isActive: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onPreview: () => void
  onOverwrite: () => void
}

function TemplateCard({
  template,
  isActive,
  onMouseEnter,
  onMouseLeave,
  onPreview,
  onOverwrite,
}: CardProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group relative rounded-xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
        isActive
          ? 'border-indigo-500 ring-1 ring-indigo-500/50'
          : 'border-zinc-800 hover:border-zinc-600'
      } bg-zinc-900`}
      onClick={onPreview}
    >
      {/* Color band */}
      <div className={`h-1.5 w-full ${template.color.replace('/40', '')}`} />

      {/* Card body */}
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">{template.emoji}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100 leading-tight">{template.name}</div>
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {template.categoryLabel}
            </span>
          </div>
          {isActive && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300 border border-indigo-700 shrink-0">
              使用中
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{template.description}</p>
      </div>

      {/* Overwrite button (shown on hover) */}
      <div className="px-3 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onOverwrite() }}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 rounded-lg transition-colors"
        >
          <ReplaceAll className="w-3 h-3 shrink-0" />
          テンプレートで上書き
        </button>
      </div>

      {/* Preview indicator */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Template Detail Pane
// ─────────────────────────────────────────────────────────────

interface DetailProps {
  template: FlowTemplate
  onClose: () => void
  onOverwrite: () => void
  onRunPrompt: (suggestionIndex: number) => void
}

function TemplateDetail({ template, onClose, onOverwrite, onRunPrompt }: DetailProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-lg">{template.emoji}</span>
        <span className="text-sm font-medium text-zinc-200 flex-1">{template.name}</span>
        <button
          onClick={onClose}
          aria-label="プレビューを閉じる"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Description */}
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">説明</h4>
          <p className="text-xs text-zinc-300 leading-relaxed">{template.description}</p>
        </div>

        {/* System prompt preview */}
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            AIシステムプロンプト
          </h4>
          <div className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700">
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-6">
              {template.systemPrompt}
            </p>
          </div>
        </div>

        {/* Suggested prompts — run on the CURRENT flow, no overwrite */}
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            このテンプレートで試すプロンプト
          </h4>
          <p className="text-[10px] text-zinc-600 mb-2 leading-relaxed">
            現在のフローはそのまま — プロンプトだけを実行します
          </p>
          <div className="flex flex-col gap-2">
            {template.userPromptSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onRunPrompt(i)}
                className="text-left text-[11px] px-3 py-2 bg-indigo-900/30 hover:bg-indigo-900/60 text-indigo-300 rounded-lg border border-indigo-800/50 transition-colors leading-relaxed"
              >
                💬 {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Markdown preview */}
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">テンプレートの初期フロー</h4>
          <pre className="text-[10px] text-zinc-500 bg-zinc-800/40 rounded-lg p-3 border border-zinc-700 overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {template.initialMarkdown.trim().slice(0, 400)}
            {template.initialMarkdown.length > 400 && '\n...'}
          </pre>
        </div>
      </div>

      {/* CTA: overwrite only */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <button
          onClick={onOverwrite}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-200 font-medium rounded-lg transition-colors"
        >
          <ReplaceAll className="w-4 h-4" />
          テンプレートで上書き
        </button>
      </div>
    </div>
  )
}
