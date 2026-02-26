import type { Node, Edge } from '@xyflow/react'
import dagre from 'dagre'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

type NodeType = 'default' | 'input' | 'output' | 'selector'

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 150 })

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  edges.forEach((e) => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
  })
}

export function parseFlowMarkdown(markdown: string): { nodes: Node[]; edges: Edge[] } {
  if (typeof markdown !== 'string') return { nodes: [], edges: [] }
  const flowBlockRegex = /```flow\n([\s\S]*?)```/g
  const nodes: Node[] = []
  const edges: Edge[] = []
  const nodeIds = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = flowBlockRegex.exec(markdown)) !== null) {
    const block = match[1]
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)

    for (const line of lines) {
      const edgeMatch = line.match(/^(.+?)\s*->\s*(.+?)(?:\s*:\s*(.+))?$/)
      if (edgeMatch) {
        const sourceRaw = edgeMatch[1].trim()
        const targetRaw = edgeMatch[2].trim()
        const label = edgeMatch[3]?.trim()

        const sourceId = extractNodeId(sourceRaw)
        const targetId = extractNodeId(targetRaw)

        if (sourceId && targetId) {
          if (!nodeIds.has(sourceId)) {
            nodes.push(makeNode(sourceId, getNodeLabel(sourceRaw) || sourceId, getNodeType(sourceRaw)))
            nodeIds.add(sourceId)
          }
          if (!nodeIds.has(targetId)) {
            nodes.push(makeNode(targetId, getNodeLabel(targetRaw) || targetId, getNodeType(targetRaw)))
            nodeIds.add(targetId)
          }

          const edgeId = `e-${sourceId}-${targetId}`
          if (!edges.find((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: sourceId,
              target: targetId,
              label: label || undefined,
              type: 'smoothstep',
            })
          }
          continue
        }
      }

      const nodeId = extractNodeId(line)
      if (nodeId && !nodeIds.has(nodeId)) {
        nodes.push(makeNode(nodeId, getNodeLabel(line) || nodeId, getNodeType(line)))
        nodeIds.add(nodeId)
      }
    }
  }

  const laidOutNodes = nodes.length > 0 ? applyDagreLayout(nodes, edges) : nodes
  return { nodes: laidOutNodes, edges }
}

function extractNodeId(raw: string): string | null {
  const m =
    raw.match(/^\[\[(.+?)\]\]/) ||
    raw.match(/^\(\((.+?)\)\)/) ||
    raw.match(/^\{(.+?)\}/) ||
    raw.match(/^\[(.+?)\]/)
  return m ? m[1] : null
}

function getNodeLabel(raw: string): string {
  const m =
    raw.match(/^\[\[.+?\]\]\s*(.*)/) ||
    raw.match(/^\(\(.+?\)\)\s*(.*)/) ||
    raw.match(/^\{.+?\}\s*(.*)/) ||
    raw.match(/^\[.+?\]\s*(.*)/)
  return m ? m[1].trim() : raw.trim()
}

function getNodeType(raw: string): NodeType {
  if (raw.startsWith('[[')) return 'input'
  if (raw.startsWith('((')) return 'output'
  if (raw.startsWith('{')) return 'selector'
  return 'default'
}

function makeNode(id: string, label: string, nodeType: NodeType): Node {
  return {
    id,
    type: 'flowNode',
    position: { x: 0, y: 0 },
    data: { label: label || id, nodeType },
  }
}
