import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react'
import type {
  Connection,
  Node,
  Edge,
  NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import CustomNode from './CustomNode'
import {
  PlusCircle,
  ZoomIn,
  ZoomOut,
  AlignCenter,
  MousePointer2,
  Pencil,
} from 'lucide-react'

const nodeTypes = { flowNode: CustomNode }

export default function FlowCanvas() {
  const { flow, applyCanvasEdit, canvasMode, setCanvasMode } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(flow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flow.edges)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNodes(flow.nodes)
    setEdges(flow.edges)
  }, [flow.nodes, flow.edges])

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, type: 'smoothstep' }, edges)
      setEdges(newEdges)
      applyCanvasEdit(nodes, newEdges)
    },
    [nodes, edges, applyCanvasEdit]
  )

  const handleNodesChange = (changes: NodeChange[]) => {
    onNodesChange(changes)
    setTimeout(() => {
      const { flow: f } = useAppStore.getState()
      applyCanvasEdit(f.nodes, f.edges)
    }, 100)
  }

  const addNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'flowNode',
      position: { x: Math.random() * 300 + 50, y: Math.random() * 200 + 50 },
      data: { label: 'New Node', nodeType: 'default' },
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    applyCanvasEdit(updated, edges)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-medium text-gray-300 flex-1">Flow Canvas</span>
        <button
          onClick={() => setCanvasMode('select')}
          className={`p-1.5 rounded transition-colors ${canvasMode === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          title="Select"
        >
          <MousePointer2 size={16} />
        </button>
        <button
          onClick={() => setCanvasMode('edit')}
          className={`p-1.5 rounded transition-colors ${canvasMode === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          title="Edit"
        >
          <Pencil size={16} />
        </button>
        <div className="w-px bg-gray-700 mx-1 h-5" />
        <button onClick={addNode} className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="Add Node">
          <PlusCircle size={16} />
        </button>
        <button className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="Fit View">
          <AlignCenter size={16} />
        </button>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-900"
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#374151" />
          <Controls className="bg-gray-800 border-gray-700" />
          <MiniMap className="bg-gray-800 border border-gray-700" nodeColor="#3b82f6" />
        </ReactFlow>
      </div>
    </div>
  )
}
