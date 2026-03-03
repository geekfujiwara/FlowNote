import React, { useState, useCallback } from 'react'
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@/store/useStore'
import type { FlowNodeData } from '@/types'
import type { Node, Edge } from '@xyflow/react'

/**
 * AddNodeEdge – エッジにマウスオーバーした際に中点に "+" ボタンを表示し、
 * クリックすると 2 つのノードの間に新しいノードを挿入するカスタムエッジ。
 */
export function AddNodeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  source,
  target,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow()
  const applyCanvasEdit = useStore((s) => s.applyCanvasEdit)

  const handleAddNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()

      const currentNodes = getNodes() as Node<FlowNodeData>[]
      const currentEdges = getEdges() as Edge[]

      const srcNode = currentNodes.find((n) => n.id === source)
      const tgtNode = currentNodes.find((n) => n.id === target)
      if (!srcNode || !tgtNode) return

      // 2 ノードの中点を計算してノードを配置（nodeWidth/Height を考慮）
      const srcCX = srcNode.position.x + (srcNode.measured?.width  ?? 180) / 2
      const srcCY = srcNode.position.y + (srcNode.measured?.height ?? 60)  / 2
      const tgtCX = tgtNode.position.x + (tgtNode.measured?.width  ?? 180) / 2
      const tgtCY = tgtNode.position.y + (tgtNode.measured?.height ?? 60)  / 2

      const newNodeId = `node-${uuidv4()}`
      const newNode: Node<FlowNodeData> = {
        id: newNodeId,
        type: 'flowNode',
        position: {
          x: (srcCX + tgtCX) / 2 - 90,
          y: (srcCY + tgtCY) / 2 - 30,
        },
        data: {
          label: '新しいノード',
          nodeType: 'default',
          isChanged: false,
        },
      }

      // 元のエッジを削除し、2 本の新しいエッジで置き換え
      const newEdges: Edge[] = [
        ...currentEdges.filter((edge) => edge.id !== id),
        {
          id: `e-${uuidv4()}`,
          source,
          target: newNodeId,
          type: 'addNodeEdge',
          animated: false,
        },
        {
          id: `e-${uuidv4()}`,
          source: newNodeId,
          target,
          type: 'addNodeEdge',
          animated: false,
        },
      ]
      const newNodes: Node<FlowNodeData>[] = [...currentNodes, newNode]

      setNodes(newNodes)
      setEdges(newEdges)
      applyCanvasEdit(newNodes, newEdges)
    },
    [id, source, target, getNodes, getEdges, setNodes, setEdges, applyCanvasEdit],
  )

  return (
    <>
      {/* エッジ本体 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        interactionWidth={20}
      />

      {/* ホバー判定用の透明幅広パス */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      <EdgeLabelRenderer>
        {/* エッジラベル（あれば中点のやや下に表示） */}
        {label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)`,
              pointerEvents: 'none',
            }}
          >
            <span className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
              {label as string}
            </span>
          </div>
        )}

        {/* ホバー時に表示する "+" ボタン */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={handleAddNode}
              className="
                flex items-center justify-center
                w-6 h-6 rounded-full
                bg-zinc-800 border border-zinc-500 text-zinc-300
                hover:bg-indigo-600 hover:border-indigo-400 hover:text-white
                transition-colors shadow-lg
              "
              title="ノードを間に追加"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
