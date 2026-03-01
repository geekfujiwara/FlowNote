import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeData } from '@/types'

export const CustomNode = memo(function CustomNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData
  const { label, nodeType, isChanged, changeSource } = nodeData

  // Highlight ring by change source
  const highlightClass = isChanged
    ? changeSource === 'agent'
      ? 'ring-2 ring-purple-400 animate-pulse-once'
      : changeSource === 'remote'
      ? 'ring-2 ring-sky-400 animate-pulse-once'
      : 'ring-2 ring-indigo-400 animate-pulse-once'
    : ''

  const selectedClass = selected ? 'ring-2 ring-white' : ''
  const ringClass = highlightClass || selectedClass

  // ── Shared handle style ──────────────────────────────────
  // Use inline `style` (not Tailwind !important) so ReactFlow can
  // measure the exact handle dimensions for correct edge routing.
  const makeHandleStyle = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    background: color,
    border: '2px solid #18181b',
    borderRadius: '50%',
  })

  // ── Input node (rounded pill, source only) ───────────────
  if (nodeType === 'input') {
    return (
      <div className="relative">
        {/* Visual shape */}
        <div
          className={`min-w-40 bg-indigo-700 text-white rounded-full border-2 border-indigo-400
            px-4 py-2 flex items-center justify-center text-sm font-medium shadow-md
            transition-all duration-300 ${ringClass}`}
        >
          <span className="truncate max-w-32">{label}</span>
        </div>
        {/* Handle is a sibling of the shape div – positioned at the outer boundary */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={makeHandleStyle('#818cf8')}
        />
      </div>
    )
  }

  // ── Output node (rounded pill, target only) ──────────────
  if (nodeType === 'output') {
    return (
      <div className="relative">
        <Handle
          type="target"
          position={Position.Top}
          style={makeHandleStyle('#34d399')}
        />
        <div
          className={`min-w-40 bg-emerald-700 text-white rounded-full border-2 border-emerald-400
            px-4 py-2 flex items-center justify-center text-sm font-medium shadow-md
            transition-all duration-300 ${ringClass}`}
        >
          <span className="truncate max-w-32">{label}</span>
        </div>
      </div>
    )
  }

  // ── Selector node (rotated diamond) ─────────────────────
  if (nodeType === 'selector') {
    return (
      <div className="relative" style={{ width: 80, height: 80 }}>
        {/* Rotated square gives diamond shape */}
        <div
          className={`absolute inset-0 bg-amber-700 border-2 border-amber-400 rotate-45
            shadow-md transition-all duration-300 ${ringClass}`}
        />
        {/* Label counter-rotated so text is upright */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="truncate max-w-16 text-xs font-medium text-white text-center leading-tight">
            {label}
          </span>
        </div>
        <Handle
          type="target"
          position={Position.Top}
          style={makeHandleStyle('#fbbf24')}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={makeHandleStyle('#fbbf24')}
        />
        <Handle
          type="source"
          id="right"
          position={Position.Right}
          style={makeHandleStyle('#fbbf24')}
        />
      </div>
    )
  }

  // ── Default node (rectangle, target + source) ────────────
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        style={makeHandleStyle('#a1a1aa')}
      />
      <div
        className={`min-w-40 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-600
          px-4 py-2 flex items-center justify-center text-sm font-medium shadow-md
          transition-all duration-300 ${ringClass}`}
      >
        <span className="truncate max-w-32">{label}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={makeHandleStyle('#a1a1aa')}
      />
    </div>
  )
})
