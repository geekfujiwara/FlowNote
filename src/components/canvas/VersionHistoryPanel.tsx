import React, { useState } from 'react'
import { useStore } from '@/store/useStore'
import { History, RotateCcw, Trash2, GitCommit, ChevronDown, ChevronUp, Save } from 'lucide-react'

export function VersionHistoryPanel() {
  const versionHistory = useStore((s) => s.versionHistory)
  const restoreVersion = useStore((s) => s.restoreVersion)
  const clearVersionHistory = useStore((s) => s.clearVersionHistory)
  const saveVersion = useStore((s) => s.saveVersion)
  const [confirmClear, setConfirmClear] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleManualSave = () => {
    saveVersion('手動スナップショット')
  }

  const handleRestore = (id: string) => {
    restoreVersion(id)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'たった今'
    if (diffMin < 60) return `${diffMin}分前`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}時間前`
    return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
        <History className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-zinc-200">バージョン履歴</span>
        <span className="ml-1 text-xs text-zinc-500">({versionHistory.length})</span>

        <div className="ml-auto flex items-center gap-1">
          {/* Manual snapshot button */}
          <button
            onClick={handleManualSave}
            title="現在の状態をスナップショット"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </button>

          {/* Clear button */}
          {versionHistory.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { clearVersionHistory(); setConfirmClear(false) }}
                  className="px-2 py-1 rounded text-xs bg-red-700 text-white hover:bg-red-600 transition-colors"
                >
                  削除
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-700 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                title="履歴をすべて削除"
                className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {versionHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600 py-12">
            <GitCommit className="w-8 h-8 opacity-40" />
            <p className="text-xs text-center leading-relaxed">
              AIが変更を適用すると<br />ここに履歴が表示されます
            </p>
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
            >
              <Save className="w-3 h-3" />
              今すぐスナップショット
            </button>
          </div>
        )}

        {versionHistory.map((v, index) => {
          const isExpanded = expandedId === v.id
          const isLatest = index === 0
          return (
            <div
              key={v.id}
              className={`rounded-lg border transition-colors ${
                isLatest
                  ? 'border-amber-600/40 bg-amber-950/20'
                  : 'border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800/70'
              }`}
            >
              {/* Main row */}
              <div className="flex items-start gap-2 px-3 py-2.5">
                {/* Timeline dot */}
                <div className="flex flex-col items-center mt-0.5 shrink-0">
                  <div className={`w-2 h-2 rounded-full mt-1 ${
                    isLatest ? 'bg-amber-400' : 'bg-zinc-600'
                  }`} />
                  {index < versionHistory.length - 1 && (
                    <div className="w-px flex-1 bg-zinc-700 mt-1 min-h-[12px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-medium truncate ${
                      isLatest ? 'text-amber-300' : 'text-zinc-300'
                    }`}>
                      {v.label}
                    </span>
                    {isLatest && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 font-medium">
                        最新
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-500">{formatTime(v.timestamp)}</span>
                    <span className="text-[11px] text-zinc-600">
                      {v.nodeCount}ノード · {v.edgeCount}エッジ
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                    title="詳細を表示"
                  >
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => handleRestore(v.id)}
                    className="p-1 rounded text-zinc-500 hover:text-indigo-400 hover:bg-zinc-700 transition-colors"
                    title="このバージョンに復元"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded markdown preview */}
              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="rounded bg-zinc-950 border border-zinc-700 p-2 max-h-40 overflow-y-auto">
                    <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {v.markdown.slice(0, 600)}{v.markdown.length > 600 ? '\n…' : ''}
                    </pre>
                  </div>
                  <button
                    onClick={() => handleRestore(v.id)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-indigo-700 text-white hover:bg-indigo-600 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    このバージョンに復元
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
