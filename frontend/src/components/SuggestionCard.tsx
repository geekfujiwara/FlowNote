import { useAppStore } from '../store'
import { Check, X, RefreshCw, GitBranch, ArrowLeftRight } from 'lucide-react'

export default function SuggestionCard() {
  const { pendingSuggestion, applySuggestion, discardSuggestion } = useAppStore()

  if (!pendingSuggestion) return null

  const handleRegenerate = () => {
    discardSuggestion()
  }

  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 mx-3 mb-2">
      <div className="text-xs text-gray-400 mb-1 font-medium">SUGGESTION</div>
      <p className="text-sm text-white mb-2">{pendingSuggestion.summary}</p>
      <div className="flex gap-2 mb-3">
        <span className="flex items-center gap-1 text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">
          <GitBranch size={10} />
          {pendingSuggestion.impacts.nodesDelta > 0 ? '+' : ''}{pendingSuggestion.impacts.nodesDelta} nodes
        </span>
        <span className="flex items-center gap-1 text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
          <ArrowLeftRight size={10} />
          {pendingSuggestion.impacts.edgesDelta > 0 ? '+' : ''}{pendingSuggestion.impacts.edgesDelta} edges
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={applySuggestion}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-medium transition-colors"
        >
          <Check size={12} /> Apply
        </button>
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded font-medium transition-colors"
        >
          <RefreshCw size={12} /> Regenerate
        </button>
        <button
          onClick={discardSuggestion}
          className="flex items-center gap-1 px-3 py-1 bg-red-600/50 hover:bg-red-500/50 text-red-200 text-xs rounded font-medium transition-colors ml-auto"
        >
          <X size={12} /> Discard
        </button>
      </div>
    </div>
  )
}
