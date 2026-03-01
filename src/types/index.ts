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

// ─────────────────────────────────────────────
// Agent trace types
// ─────────────────────────────────────────────

export interface AgentTraceEntry {
  seq: number
  type: 'tool_call'
  tool: string
  args: Record<string, unknown>
  result: string
  durationMs: number
  timestamp: string
}

// ─────────────────────────────────────────────
// Agent request/response log types
// ─────────────────────────────────────────────

export interface AgentLog {
  id: string
  timestamp: string
  message: string
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown> | null
  errorMessage?: string
  durationMs: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  agentTrace?: AgentTraceEntry[]
  executionMs?: number
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
  agentTrace?: AgentTraceEntry[]
  executionMs?: number
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

// ─────────────────────────────────────────────
// Template types
// ─────────────────────────────────────────────

export type TemplateCategory =
  | 'analysis'
  | 'planning'
  | 'process'
  | 'organization'

export interface FlowTemplate {
  id: string
  name: string
  description: string
  emoji: string
  color: string        // Tailwind bg color class for card accent
  category: TemplateCategory
  categoryLabel: string
  initialMarkdown: string
  systemPrompt: string
  userPromptSuggestions: string[]
}
