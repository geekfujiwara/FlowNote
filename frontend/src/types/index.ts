export interface NoteItem {
  id: string
  title: string
  updatedAt: string
  tags?: string[]
}

export interface FlowNode {
  id: string
  type: 'default' | 'input' | 'output' | 'selector'
  label: string
  position: { x: number; y: number }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

export interface PendingSuggestion {
  suggestionId: string
  markdownPatch?: string
  markdown?: string
  summary: string
  impacts: {
    nodesDelta: number
    edgesDelta: number
  }
}
