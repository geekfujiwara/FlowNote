import React from 'react'
import type { Suggestion } from '@/types'
import { useStore } from '@/store/useStore'
import {
  Check,
  X,
  RefreshCw,
  Layers,
  GitBranch,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

interface Props {
  suggestion: Suggestion
}

export function SuggestionCard({ suggestion }: Props) {
  const applySuggestion = useStore((s) => s.applySuggestion)
  const discardSuggestion = useStore((s) => s.discardSuggestion)
  const sendMessage = useStore((s) => s.sendMessageToAgent)

  const { summary, impacts } = suggestion
  const { nodesDelta, edgesDelta } = impacts

  const handleRegenerate = () => {
    discardSuggestion()
    sendMessage('別のアプローチで提案してください')
  }

  return (
    <div className="rounded-xl border border-purple-700 bg-purple-950/50 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/40 border-b border-purple-800">
        <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
        <span className="text-xs font-semibold text-purple-200">AI 提案</span>
      </div>

      {/* Summary */}
      <div className="px-3 py-2.5">
        <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>
      </div>

      {/* Impacts */}
      <div className="flex gap-3 px-3 pb-2.5">
        <ImpactBadge
          icon={<Layers className="w-3 h-3" />}
          label="ノード"
          delta={nodesDelta}
        />
        <ImpactBadge
          icon={<GitBranch className="w-3 h-3" />}
          label="エッジ"
          delta={edgesDelta}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 px-3 pb-3">
        {/* Apply */}
        <button
          onClick={applySuggestion}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          適用
        </button>

        {/* Regenerate */}
        <button
          onClick={handleRegenerate}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          title="再生成"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Discard */}
        <button
          onClick={discardSuggestion}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          title="破棄"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function ImpactBadge({
  icon,
  label,
  delta,
}: {
  icon: React.ReactNode
  label: string
  delta: number
}) {
  const color =
    delta > 0
      ? 'text-emerald-400'
      : delta < 0
      ? 'text-red-400'
      : 'text-zinc-500'

  const DeltaIcon =
    delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-400">
      {icon}
      <span>{label}</span>
      <span className={`flex items-center gap-0.5 font-medium ${color}`}>
        <DeltaIcon className="w-3 h-3" />
        {delta >= 0 ? `+${delta}` : delta}
      </span>
    </div>
  )
}
