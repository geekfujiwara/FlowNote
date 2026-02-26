import type { ParsedFlow, ParsedNode, ParsedEdge, FlowNodeType } from '@/types'

// ─────────────────────────────────────────────
// Regular expressions
// ─────────────────────────────────────────────

// Match ```flow ... ``` blocks (including multi-line)
const FLOW_BLOCK_RE = /```flow\r?\n([\s\S]*?)```/g

// Node definition patterns
const NODE_PATTERNS: Array<{ re: RegExp; type: FlowNodeType }> = [
  { re: /^\[\[(.+?)\]\]\s+(.+)$/, type: 'input'    },   // [[id]] Label
  { re: /^\(\((.+?)\)\)\s+(.+)$/, type: 'output'   },   // ((id)) Label
  { re: /^\{(.+?)\}\s+(.+)$/,     type: 'selector' },   // {id} Label
  { re: /^\[(.+?)\]\s+(.+)$/,     type: 'default'  },   // [id] Label
]

// Edge pattern: [A] -> [B] or [A] -> [B] : Label
const EDGE_RE = /^\[(.+?)\]\s*->\s*\[(.+?)\](?:\s*:\s*(.+))?$/

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

export function parseFlowFromMarkdown(markdown: string): ParsedFlow {
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  const nodeIds = new Set<string>()
  let edgeCounter = 0

  let match: RegExpExecArray | null
  // Reset lastIndex
  FLOW_BLOCK_RE.lastIndex = 0

  while ((match = FLOW_BLOCK_RE.exec(markdown)) !== null) {
    const blockContent = match[1]
    const lines = blockContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    for (const line of lines) {
      // Try edge first (prevents [a] -> [b] being matched as node)
      const edgeMatch = EDGE_RE.exec(line)
      if (edgeMatch) {
        const [, source, target, label] = edgeMatch
        // Auto-create implicit nodes
        if (!nodeIds.has(source)) {
          nodes.push({ id: source, label: source, type: 'default' })
          nodeIds.add(source)
        }
        if (!nodeIds.has(target)) {
          nodes.push({ id: target, label: target, type: 'default' })
          nodeIds.add(target)
        }
        edges.push({
          id: `e${++edgeCounter}-${source}-${target}`,
          source,
          target,
          label: label?.trim(),
        })
        continue
      }

      // Try node patterns
      for (const { re, type } of NODE_PATTERNS) {
        const nodeMatch = re.exec(line)
        if (nodeMatch) {
          const [, id, label] = nodeMatch
          if (!nodeIds.has(id)) {
            nodes.push({ id, label, type })
            nodeIds.add(id)
          }
          break
        }
      }
    }
  }

  return { nodes, edges }
}

// ─────────────────────────────────────────────
// Serialise back to flow block text
// ─────────────────────────────────────────────

export function serializeFlowToBlock(flow: ParsedFlow): string {
  const nodeLines = flow.nodes.map((n) => {
    switch (n.type) {
      case 'input':    return `[[${n.id}]] ${n.label}`
      case 'output':   return `((${n.id})) ${n.label}`
      case 'selector': return `{${n.id}} ${n.label}`
      default:         return `[${n.id}] ${n.label}`
    }
  })

  const edgeLines = flow.edges.map((e) => {
    const base = `[${e.source}] -> [${e.target}]`
    return e.label ? `${base} : ${e.label}` : base
  })

  return '```flow\n' + [...nodeLines, '', ...edgeLines].join('\n') + '\n```'
}
