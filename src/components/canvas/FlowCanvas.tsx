import React, { useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import { CustomNode } from './CustomNode'
import { CanvasEditToolbar } from './CanvasEditToolbar'
import { NodeEdgeInspector } from './NodeEdgeInspector'
import type { FlowNodeData, FlowNodeType } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const nodeTypes: NodeTypes = {
  flowNode: CustomNode,
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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(storeEdges)

  // Inspector state
  type InspectorTarget =
    | { kind: 'node'; node: Node<FlowNodeData> }
    | { kind: 'edge'; edge: Edge }
    | null
  const [inspectorTarget, setInspectorTarget] = React.useState<InspectorTarget>(null)

  // Keep local state in sync with store (when markdown changes)
  React.useEffect(() => {
    setNodes(storeNodes)
  }, [storeNodes, setNodes])

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
    </div>
  )
}
