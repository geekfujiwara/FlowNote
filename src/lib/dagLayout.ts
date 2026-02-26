import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import type { ParsedFlow, FlowNodeData } from '@/types'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

export function applyDagreLayout(
  flow: ParsedFlow,
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 })

  // Add nodes
  for (const n of flow.nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Add edges
  for (const e of flow.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target)
    }
  }

  dagre.layout(g)

  const xyNodes: Node<FlowNodeData>[] = flow.nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      id: n.id,
      type: 'flowNode',
      position: {
        x: pos ? pos.x - NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      },
      data: {
        label: n.label,
        nodeType: n.type,
        isChanged: false,
      },
    }
  })

  const xyEdges: Edge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    animated: false,
  }))

  return { nodes: xyNodes, edges: xyEdges }
}
