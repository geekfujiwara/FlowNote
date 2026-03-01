import React from 'react'
import { useStore } from '@/store/useStore'
import { useReactFlow } from '@xyflow/react'
import {
  MousePointer2,
  Pencil,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  LayoutDashboard,
  Download,
} from 'lucide-react'
import type { FlowNodeData } from '@/types'
import type { Node } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { applyDagreLayout } from '@/lib/dagLayout'
import { parseFlowFromMarkdown } from '@/lib/flowParser'
import { exportFlowAsSvg, downloadSvg } from '@/lib/exportSvg'

export function CanvasEditToolbar() {
  const canvasMode = useStore((s) => s.canvasMode)
  const setCanvasMode = useStore((s) => s.setCanvasMode)
  const applyCanvasEdit = useStore((s) => s.applyCanvasEdit)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const markdown = useStore((s) => s.markdown)
  const currentNote = useStore((s) => s.currentNote)

  const { zoomIn, zoomOut, fitView, getNodes, getEdges } = useReactFlow()

  const handleAddNode = () => {
    const newNode: Node<FlowNodeData> = {
      id: uuidv4().slice(0, 8),
      type: 'flowNode',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        label: '新しいノード',
        nodeType: 'default',
        isChanged: true,
        changeSource: 'user',
      },
    }
    const updated = [...nodes, newNode]
    applyCanvasEdit(updated, edges)
  }

  const handleAutoLayout = () => {
    const parsed = parseFlowFromMarkdown(markdown)
    const { nodes: layouted, edges: layoutedEdges } = applyDagreLayout(parsed)
    applyCanvasEdit(layouted, layoutedEdges)
    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }

  const handleExportSvg = () => {
    const liveNodes = getNodes() as Node<FlowNodeData>[]
    const liveEdges = getEdges()
    const title = currentNote?.title ?? 'FlowNote'
    const svg = exportFlowAsSvg(liveNodes, liveEdges, title)
    downloadSvg(svg, title)
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-zinc-900 border border-zinc-700 rounded-xl p-1.5 shadow-xl">
      {/* Mode: Select */}
      <ToolBtn
        icon={<MousePointer2 className="w-3.5 h-3.5" />}
        title="選択モード"
        active={canvasMode === 'select'}
        onClick={() => setCanvasMode('select')}
      />

      {/* Mode: Edit */}
      <ToolBtn
        icon={<Pencil className="w-3.5 h-3.5" />}
        title="編集モード（ノード追加・削除）"
        active={canvasMode === 'edit'}
        onClick={() => setCanvasMode('edit')}
      />

      <div className="h-px bg-zinc-700 my-0.5" />

      {/* Add node */}
      <ToolBtn
        icon={<GitBranch className="w-3.5 h-3.5" />}
        title="ノードを追加"
        onClick={handleAddNode}
      />

      {/* Auto layout */}
      <ToolBtn
        icon={<LayoutDashboard className="w-3.5 h-3.5" />}
        title="自動レイアウト"
        onClick={handleAutoLayout}
      />

      <div className="h-px bg-zinc-700 my-0.5" />

      {/* Zoom */}
      <ToolBtn icon={<ZoomIn className="w-3.5 h-3.5" />} title="ズームイン" onClick={() => zoomIn()} />
      <ToolBtn icon={<ZoomOut className="w-3.5 h-3.5" />} title="ズームアウト" onClick={() => zoomOut()} />
      <ToolBtn icon={<Maximize2 className="w-3.5 h-3.5" />} title="フィット" onClick={() => fitView({ padding: 0.2 })} />

      <div className="h-px bg-zinc-700 my-0.5" />

      {/* Export SVG */}
      <ToolBtn
        icon={<Download className="w-3.5 h-3.5" />}
        title="SVGとして書き出し"
        onClick={handleExportSvg}
      />
    </div>
  )
}

interface ToolBtnProps {
  icon: React.ReactNode
  title: string
  onClick: () => void
  active?: boolean
}

function ToolBtn({ icon, title, onClick, active }: ToolBtnProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
      }`}
    >
      {icon}
    </button>
  )
}
