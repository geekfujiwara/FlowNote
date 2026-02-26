import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useAppStore } from '../store'
import { Circle, Square, Triangle, Diamond } from 'lucide-react'

const typeStyles: Record<string, string> = {
  input: 'bg-green-900/60 border-green-500 text-green-200',
  output: 'bg-red-900/60 border-red-500 text-red-200',
  selector: 'bg-yellow-900/60 border-yellow-500 text-yellow-200',
  default: 'bg-blue-900/60 border-blue-500 text-blue-200',
}

const typeIcons: Record<string, React.ReactNode> = {
  input: <Circle size={12} />,
  output: <Square size={12} />,
  selector: <Diamond size={12} />,
  default: <Triangle size={12} />,
}

export default function CustomNode({ id, data }: NodeProps) {
  const { lastAppliedChange } = useAppStore()
  const nodeType = (data.nodeType as string) || 'default'
  const label = (data.label as string) || id
  const isHighlighted = lastAppliedChange?.changedNodeIds?.includes(id)

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 flex items-center gap-2 min-w-[120px] shadow-lg transition-all ${typeStyles[nodeType] || typeStyles.default} ${isHighlighted ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
      style={{ animation: 'fadeInScale 0.3s ease-out' }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <span className="opacity-60">{typeIcons[nodeType]}</span>
      <span className="text-xs font-medium truncate">{label}</span>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  )
}
