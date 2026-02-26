import React, { useEffect, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { FlowNodeData, FlowNodeType } from '@/types'
import { Check, Trash2, X } from 'lucide-react'

type InspectorTarget =
  | { kind: 'node'; node: Node<FlowNodeData> }
  | { kind: 'edge'; edge: Edge }
  | null

interface Props {
  target: InspectorTarget
  onClose: () => void
  onUpdateNode: (id: string, label: string, nodeType: FlowNodeType) => void
  onDeleteNode: (id: string) => void
  onUpdateEdge: (id: string, label: string) => void
  onDeleteEdge: (id: string) => void
}

const NODE_TYPE_OPTIONS: { value: FlowNodeType; label: string; color: string }[] = [
  { value: 'default',  label: '処理（長方形）',       color: 'bg-zinc-600' },
  { value: 'input',    label: '開始（丸型）',          color: 'bg-indigo-600' },
  { value: 'output',   label: '終了（丸型）',          color: 'bg-emerald-600' },
  { value: 'selector', label: '分岐（ダイヤモンド）',  color: 'bg-amber-600' },
]

export function NodeEdgeInspector({
  target,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
}: Props) {
  // ─── Node form state ──────────────────────────────────────
  const [nodeLabel, setNodeLabel]   = useState('')
  const [nodeType,  setNodeType]    = useState<FlowNodeType>('default')

  // ─── Edge form state ──────────────────────────────────────
  const [edgeLabel, setEdgeLabel]   = useState('')

  const labelInputRef = useRef<HTMLInputElement>(null)

  // Initialise fields whenever the target changes
  useEffect(() => {
    if (!target) return
    if (target.kind === 'node') {
      setNodeLabel(target.node.data.label ?? '')
      setNodeType(target.node.data.nodeType ?? 'default')
    } else {
      setEdgeLabel((target.edge.label as string) ?? '')
    }
    // Auto-focus label field
    setTimeout(() => labelInputRef.current?.focus(), 50)
  }, [target])

  if (!target) return null

  // ─── Helpers ─────────────────────────────────────────────

  function handleNodeApply() {
    if (target?.kind !== 'node') return
    onUpdateNode(target.node.id, nodeLabel.trim() || target.node.data.label, nodeType)
  }

  function handleEdgeApply() {
    if (target?.kind !== 'edge') return
    onUpdateEdge(target.edge.id, edgeLabel.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!target) return
    if (e.key === 'Enter') {
      e.preventDefault()
      target.kind === 'node' ? handleNodeApply() : handleEdgeApply()
    }
    if (e.key === 'Escape') onClose()
  }

  // ─── Shared UI fragments ─────────────────────────────────

  const panelHeader = (title: string, subtitle: string) => (
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="text-xs font-semibold text-zinc-200 leading-tight">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate max-w-40">{subtitle}</p>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors -mt-0.5 -mr-0.5"
        title="閉じる"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  const labelField = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <div className="mb-3">
      <label className="block text-xs text-zinc-400 mb-1">ラベル</label>
      <input
        ref={labelInputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-2.5 py-1.5 text-sm text-zinc-100
          placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  )

  const actionRow = (onApply: () => void, onDelete: () => void) => (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onApply}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
          bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
        更新
      </button>
      <button
        onClick={onDelete}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
          bg-red-700/70 hover:bg-red-600 text-red-100 text-xs font-medium transition-colors"
        title="削除"
      >
        <Trash2 className="w-3.5 h-3.5" />
        削除
      </button>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────

  return (
    <div
      className="
        absolute bottom-4 right-4 z-20
        w-60 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl
        backdrop-blur-sm p-4
        animate-slide-up
      "
    >
      {target.kind === 'node' ? (
        <>
          {panelHeader('ノードを編集', `ID: ${target.node.id}`)}

          {labelField(nodeLabel, setNodeLabel, 'ノードの表示名')}

          {/* Node type selector */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1.5">ノードタイプ</label>
            <div className="grid grid-cols-2 gap-1.5">
              {NODE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNodeType(opt.value)}
                  className={`
                    flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all text-left
                    ${nodeType === opt.value
                      ? 'bg-zinc-600 text-zinc-100 ring-1 ring-zinc-400'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }
                  `}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${opt.color}`} />
                  <span className="leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {actionRow(
            handleNodeApply,
            () => onDeleteNode(target.node.id),
          )}
        </>
      ) : (
        <>
          {panelHeader('エッジを編集', `${target.edge.source} → ${target.edge.target}`)}

          {labelField(edgeLabel, setEdgeLabel, 'エッジラベル（省略可）')}

          {actionRow(
            handleEdgeApply,
            () => onDeleteEdge(target.edge.id),
          )}
        </>
      )}
    </div>
  )
}
