import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeData } from '@/types'

export const CustomNode = memo(function CustomNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData
  const { label, nodeType, isChanged, changeSource } = nodeData

  // Highlight colour by change source
  const highlightClass = isChanged
    ? changeSource === 'agent'
      ? 'ring-2 ring-purple-400 animate-pulse-once'
      : changeSource === 'remote'
      ? 'ring-2 ring-sky-400 animate-pulse-once'
      : 'ring-2 ring-indigo-400 animate-pulse-once'
    : ''

  const selectedClass = selected ? 'ring-2 ring-white' : ''

  const baseClass = `
    relative flex items-center justify-center px-4 py-2 text-sm font-medium
    transition-all duration-300 shadow-md
    ${highlightClass || selectedClass}
  `

  if (nodeType === 'input') {
    return (
      <div className={`${baseClass} min-w-40 bg-indigo-700 text-white rounded-full border-2 border-indigo-400`}>
        <span className="truncate max-w-32">{label}</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-indigo-400 !w-3 !h-3 !border-2 !border-zinc-900"
        />
      </div>
    )
  }

  if (nodeType === 'output') {
    return (
      <div className={`${baseClass} min-w-40 bg-emerald-700 text-white rounded-full border-2 border-emerald-400`}>
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-zinc-900"
        />
        <span className="truncate max-w-32">{label}</span>
      </div>
    )
  }

  if (nodeType === 'selector') {
    return (
      <div className={`${baseClass} min-w-40 bg-amber-700 text-white rotate-45`} style={{ width: 80, height: 80 }}>
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-amber-400 !w-3 !h-3 !border-2 !border-zinc-900 !-rotate-45"
        />
        <span className="truncate max-w-24 -rotate-45 text-xs text-center">{label}</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-amber-400 !w-3 !h-3 !border-2 !border-zinc-900 !-rotate-45"
        />
        <Handle
          type="source"
          id="right"
          position={Position.Right}
          className="!bg-amber-400 !w-3 !h-3 !border-2 !border-zinc-900 !-rotate-45"
        />
      </div>
    )
  }

  // Default node
  return (
    <div className={`${baseClass} min-w-40 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-600`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-zinc-400 !w-3 !h-3 !border-2 !border-zinc-900"
      />
      <span className="truncate max-w-32">{label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-zinc-400 !w-3 !h-3 !border-2 !border-zinc-900"
      />
    </div>
  )
})
