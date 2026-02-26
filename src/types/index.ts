// ─────────────────────────────────────────────
// Note / Storage types
// ─────────────────────────────────────────────

export interface NoteItem {
  id: string
  title: string
  updatedAt: string
  tags?: string[]
}

export interface NoteDetail extends NoteItem {
  markdown: string
}

// ─────────────────────────────────────────────
// Flow domain types
// ─────────────────────────────────────────────

export type FlowNodeType = 'default' | 'input' | 'output' | 'selector'

export interface ParsedNode {
  id: string
  label: string
  type: FlowNodeType
}

export interface ParsedEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface ParsedFlow {
  nodes: ParsedNode[]
  edges: ParsedEdge[]
}

// ─────────────────────────────────────────────
// Chat / Agent types
// ─────────────────────────────────────────────

export type AgentStatus = 'idle' | 'thinking' | 'error'
export type ChangeSource = 'user' | 'agent' | 'remote'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

export interface SuggestionImpacts {
  nodesDelta: number
  edgesDelta: number
  changedNodeIds: string[]
  changedEdgeIds: string[]
}

export interface Suggestion {
  suggestionId: string
  markdownPatch?: string
  markdown?: string
  summary: string
  impacts: SuggestionImpacts
}

// ─────────────────────────────────────────────
// Version history
// ─────────────────────────────────────────────

export interface VersionEntry {
  id: string
  label: string
  timestamp: string
  markdown: string
  nodeCount: number
  edgeCount: number
}

// ─────────────────────────────────────────────
// Canvas / UI types
// ─────────────────────────────────────────────

export type CanvasMode = 'select' | 'edit'

export interface LastAppliedChange {
  source: ChangeSource
  changedNodeIds: string[]
  changedEdgeIds: string[]
}

// ─────────────────────────────────────────────
// @xyflow/react extended data
// ─────────────────────────────────────────────

export interface FlowNodeData extends Record<string, unknown> {
  label: string
  nodeType: FlowNodeType
  isChanged?: boolean
  changeSource?: ChangeSource
}
