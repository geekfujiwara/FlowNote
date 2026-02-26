import { useAppStore } from '../store'
import { FileText, Tag, GitBranch, ArrowLeftRight, Clock } from 'lucide-react'

export default function FlowMetadataPanel() {
  const { currentNote, flow } = useAppStore()

  if (!currentNote) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
      <div className="flex items-center gap-1.5">
        <FileText size={12} />
        <span className="text-white font-medium">{currentNote.title}</span>
      </div>
      {currentNote.tags && currentNote.tags.length > 0 && (
        <div className="flex items-center gap-1">
          <Tag size={12} />
          {currentNote.tags.map((t) => (
            <span key={t} className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <GitBranch size={12} />
        <span>{flow.nodes.length} nodes</span>
      </div>
      <div className="flex items-center gap-1">
        <ArrowLeftRight size={12} />
        <span>{flow.edges.length} edges</span>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <Clock size={12} />
        <span>{new Date(currentNote.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  )
}
