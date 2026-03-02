import React, { useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  getBezierPath,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type ConnectionLineComponentProps,
  BackgroundVariant,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Check, Undo2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CustomNode } from './CustomNode'
import { CanvasEditToolbar } from './CanvasEditToolbar'
import { NodeEdgeInspector } from './NodeEdgeInspector'
import { PixelLoadingOverlay } from './PixelLoadingOverlay'
import type { FlowNodeData, FlowNodeType } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const nodeTypes: NodeTypes = {
  flowNode: CustomNode,
}

// ── Animated connection line drawn while dragging from a handle ──────────────
function AnimatedConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition ?? Position.Bottom,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition ?? Position.Top,
  })

  return (
    <g>
      {/* Glow layer */}
      <path
        fill="none"
        stroke="#818cf8"
        strokeWidth={8}
        strokeOpacity={0.25}
        strokeLinecap="round"
        d={edgePath}
        className="connection-line-glow"
      />
      {/* Main animated dash */}
      <path
        fill="none"
        stroke="#a5b4fc"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="6 4"
        d={edgePath}
        className="connection-line-dash"
      />
      {/* Trailing dot at cursor */}
      <circle
        cx={toX}
        cy={toY}
        r={5}
        fill="#818cf8"
        stroke="#c7d2fe"
        strokeWidth={2}
        className="connection-line-dot"
      />
    </g>
  )
}

// ── Readonly flow panel (for compare view) ──────────────────────────────────
interface ReadonlyFlowPanelProps {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
  label: string
  labelColor: string
}

function ReadonlyFlowPanel({ nodes, edges, label, labelColor }: ReadonlyFlowPanelProps) {
  const miniMapStyle = { backgroundColor: '#18181b' }
  return (
    <div className="flex-1 relative bg-zinc-950 border-r border-zinc-700 last:border-r-0 overflow-hidden">
      {/* Panel header label */}
      <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg ${labelColor}`}>
        {label}
      </div>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          className="bg-zinc-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#3f3f46" />
          <Controls className="!bg-zinc-800 !border-zinc-700" showInteractive={false} />
          <MiniMap
            style={miniMapStyle}
            nodeColor={(n) => {
              const data = n.data as FlowNodeData
              switch (data?.nodeType) {
                case 'input':    return '#6366f1'
                case 'output':   return '#10b981'
                case 'selector': return '#f59e0b'
                default:         return '#52525b'
              }
            }}
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

// ── Compare split view ────────────────────────────────────────────────────────
interface CompareSplitViewProps {
  beforeNodes: Node<FlowNodeData>[]
  beforeEdges: Edge[]
  afterNodes: Node<FlowNodeData>[]
  afterEdges: Edge[]
  onConfirm: () => void
  onRevert: () => void
}

function CompareSplitView({ beforeNodes, beforeEdges, afterNodes, afterEdges, onConfirm, onRevert }: CompareSplitViewProps) {
  const afterNodeIds = new Set(afterNodes.map((n) => n.id))
  const beforeNodeIds = new Set(beforeNodes.map((n) => n.id))

  // Mark removed nodes in "before" panel (exist in before, not in after)
  const diffBeforeNodes = beforeNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isChanged: !afterNodeIds.has(n.id),
      changeSource: 'removed' as const,
    },
  }))

  // Mark added nodes in "after" panel (exist in after, not in before)
  const diffAfterNodes = afterNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isChanged: !beforeNodeIds.has(n.id),
      changeSource: 'agent' as const,
    },
  }))

  const removedCount = diffBeforeNodes.filter((n) => n.data.isChanged).length
  const addedCount = diffAfterNodes.filter((n) => n.data.isChanged).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Diff summary bar with action buttons */}
      <div className="flex items-center gap-3 px-4 bg-zinc-900 border-b border-zinc-700 py-1.5">
        <span className="text-xs text-zinc-400 font-medium">AI変更の比較</span>
        {removedCount > 0 && (
          <span className="text-xs text-rose-400">−&nbsp;{removedCount}ノード削除</span>
        )}
        {addedCount > 0 && (
          <span className="text-xs text-purple-400">+&nbsp;{addedCount}ノード追加</span>
        )}
        {removedCount === 0 && addedCount === 0 && (
          <span className="text-xs text-zinc-500">ノードの差分なし</span>
        )}

        <div className="flex-1" />

        {/* Revert button */}
        <button
          onClick={onRevert}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
            bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white
            border border-zinc-600 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          元に戻す
        </button>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
            bg-purple-600 hover:bg-purple-500 text-white
            border border-purple-500 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          適用する
        </button>
      </div>
      {/* Two panels side by side */}
      <div className="flex flex-1 overflow-hidden">
        <ReadonlyFlowPanel
          nodes={diffBeforeNodes}
          edges={beforeEdges}
          label="変更前"
          labelColor="bg-zinc-700"
        />
        <ReadonlyFlowPanel
          nodes={diffAfterNodes}
          edges={afterEdges}
          label="変更後"
          labelColor="bg-indigo-600"
        />
      </div>
    </div>
  )
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  )
}

function FlowCanvasInner() {
  const storeNodes = useStore((s) => s.nodes)
  const storeEdges = useStore((s) => s.edges)
  const applyCanvasEdit = useStore((s) => s.applyCanvasEdit)
  const setSelection = useStore((s) => s.setSelection)
  const canvasMode = useStore((s) => s.canvasMode)
  const currentNote = useStore((s) => s.currentNote)
  const agentStatus = useStore((s) => s.agentStatus)
  const compareMode = useStore((s) => s.compareMode)
  const beforeCompareNodes = useStore((s) => s.beforeCompareNodes)
  const beforeCompareEdges = useStore((s) => s.beforeCompareEdges)
  const applySuggestion = useStore((s) => s.applySuggestion)
  const revertLastAgentChange = useStore((s) => s.revertLastAgentChange)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(storeEdges)
  const { fitView } = useReactFlow()

  // Track previous node IDs (sorted) to detect structural changes (restore/apply)
  // vs shallow data changes (animation flag clear, drag position update).
  const prevNodeKeyRef = React.useRef<string>('')

  // Inspector state
  type InspectorTarget =
    | { kind: 'node'; node: Node<FlowNodeData> }
    | { kind: 'edge'; edge: Edge }
    | null
  const [inspectorTarget, setInspectorTarget] = React.useState<InspectorTarget>(null)

  // Keep local state in sync with store (when markdown changes).
  // Re-fit the viewport only when the set of node IDs changes (restore /
  // apply), not on every shallow update (drag, animation-flag clear, etc.).
  React.useEffect(() => {
    setNodes(storeNodes)
    const newKey = storeNodes.map((n) => n.id).sort().join(',')
    if (newKey !== prevNodeKeyRef.current && storeNodes.length > 0) {
      prevNodeKeyRef.current = newKey
      // Defer fitView until ReactFlow has measured the new nodes
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 300 })
      })
    }
  }, [storeNodes, setNodes, fitView])

  React.useEffect(() => {
    setEdges(storeEdges)
  }, [storeEdges, setEdges])

  // Close inspector when target node/edge disappears from the canvas
  React.useEffect(() => {
    if (!inspectorTarget) return
    if (inspectorTarget.kind === 'node') {
      if (!nodes.find((n) => n.id === inspectorTarget.node.id)) setInspectorTarget(null)
    } else {
      if (!edges.find((e) => e.id === inspectorTarget.edge.id)) setInspectorTarget(null)
    }
  }, [nodes, edges]) // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e-${uuidv4()}`,
        type: 'smoothstep',
      }
      const updated = addEdge(newEdge, edges)
      setEdges(updated)
      applyCanvasEdit(nodes, updated)
    },
    [edges, nodes, setEdges, applyCanvasEdit]
  )

  const onNodeDragStop = useCallback(() => {
    applyCanvasEdit(nodes, edges)
  }, [nodes, edges, applyCanvasEdit])

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelection(
        selNodes.map((n) => n.id),
        selEdges.map((e) => e.id)
      )
    },
    [setSelection]
  )

  // ─── Inspector click handlers ─────────────────────────────

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setInspectorTarget({ kind: 'node', node: node as Node<FlowNodeData> })
    },
    []
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setInspectorTarget({ kind: 'edge', edge })
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setInspectorTarget(null)
  }, [])

  // ─── Inspector update / delete ────────────────────────────

  const handleUpdateNode = useCallback(
    (id: string, label: string, nodeType: FlowNodeType) => {
      const updated = nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, label, nodeType } }
          : n
      )
      setNodes(updated)
      applyCanvasEdit(updated, edges)
      setInspectorTarget(null)
    },
    [nodes, edges, setNodes, applyCanvasEdit]
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      const updatedNodes = nodes.filter((n) => n.id !== id)
      const updatedEdges = edges.filter((e) => e.source !== id && e.target !== id)
      setNodes(updatedNodes)
      setEdges(updatedEdges)
      applyCanvasEdit(updatedNodes, updatedEdges)
      setInspectorTarget(null)
    },
    [nodes, edges, setNodes, setEdges, applyCanvasEdit]
  )

  const handleUpdateEdge = useCallback(
    (id: string, label: string) => {
      const updated = edges.map((e) =>
        e.id === id
          ? { ...e, label: label || undefined }
          : e
      )
      setEdges(updated)
      applyCanvasEdit(nodes, updated)
      setInspectorTarget(null)
    },
    [nodes, edges, setEdges, applyCanvasEdit]
  )

  const handleDeleteEdge = useCallback(
    (id: string) => {
      const updated = edges.filter((e) => e.id !== id)
      setEdges(updated)
      applyCanvasEdit(nodes, updated)
      setInspectorTarget(null)
    },
    [nodes, edges, setEdges, applyCanvasEdit]
  )

  const minimapStyle = {
    backgroundColor: '#18181b',
  }

  if (!currentNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-600 flex-col gap-3">
        <div className="text-4xl">🔷</div>
        <p className="text-sm">ノートを選択するとフローが表示されます</p>
      </div>
    )
  }

  // ── Compare split view ────────────────────────────────────────
  if (compareMode && beforeCompareNodes && beforeCompareEdges) {
    return (
      <div className="flex-1 relative flex flex-col">
        {/* Toolbar still visible so user can toggle compare off */}
        <CanvasEditToolbar />
        <CompareSplitView
          beforeNodes={beforeCompareNodes}
          beforeEdges={beforeCompareEdges}
          afterNodes={storeNodes}
          afterEdges={storeEdges}
          onConfirm={applySuggestion}
          onRevert={revertLastAgentChange}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 relative bg-zinc-950">
      <CanvasEditToolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionLineComponent={AnimatedConnectionLine}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={canvasMode === 'select' || canvasMode === 'edit'}
        nodesConnectable={canvasMode === 'edit'}
        elementsSelectable
        deleteKeyCode={canvasMode === 'edit' ? 'Delete' : null}
        className="bg-zinc-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
        <Controls
          className="!bg-zinc-800 !border-zinc-700"
          showInteractive={false}
        />
        <MiniMap
          style={minimapStyle}
          nodeColor={(n) => {
            const data = n.data as FlowNodeData
            switch (data?.nodeType) {
              case 'input':    return '#6366f1'
              case 'output':   return '#10b981'
              case 'selector': return '#f59e0b'
              default:         return '#52525b'
            }
          }}
          maskColor="rgba(0,0,0,0.4)"
        />
      </ReactFlow>

      {/* Node / Edge inspector panel */}
      <NodeEdgeInspector
        target={inspectorTarget}
        onClose={() => setInspectorTarget(null)}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onUpdateEdge={handleUpdateEdge}
        onDeleteEdge={handleDeleteEdge}
      />

      {/* 16-bit pixel loading overlay — shown while AI is designing the flow */}
      {agentStatus === 'thinking' && <PixelLoadingOverlay />}
    </div>
  )
}
