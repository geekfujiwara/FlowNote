import type { Node, Edge } from '@xyflow/react'

function nodeToSyntax(node: Node): string {
  const label = (node.data?.label as string) || node.id
  const nodeType = (node.data?.nodeType as string) || 'default'
  const labelPart = label !== node.id ? ` ${label}` : ''
  switch (nodeType) {
    case 'input':
      return `[[${node.id}]]${labelPart}`
    case 'output':
      return `((${node.id}))${labelPart}`
    case 'selector':
      return `{${node.id}}${labelPart}`
    default:
      return `[${node.id}]${labelPart}`
  }
}

export function flowToMarkdown(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) return ''

  const lines: string[] = []

  const connectedIds = new Set<string>()
  edges.forEach((e) => {
    connectedIds.add(e.source)
    connectedIds.add(e.target)
  })

  nodes.filter((n) => !connectedIds.has(n.id)).forEach((n) => {
    lines.push(nodeToSyntax(n))
  })

  edges.forEach((e) => {
    const source = nodes.find((n) => n.id === e.source)
    const target = nodes.find((n) => n.id === e.target)
    if (source && target) {
      const edgeLine = e.label
        ? `${nodeToSyntax(source)} -> ${nodeToSyntax(target)} : ${e.label}`
        : `${nodeToSyntax(source)} -> ${nodeToSyntax(target)}`
      lines.push(edgeLine)
    }
  })

  return '```flow\n' + lines.join('\n') + '\n```'
}
