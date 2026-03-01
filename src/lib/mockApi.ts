/**
 * Mock API – simulates the Azure Functions backend using localStorage.
 * Flip VITE_USE_MOCK_API=false to route to the real backend.
 */

import { v4 as uuidv4 } from 'uuid'
import type { NoteItem, NoteDetail, Suggestion, AgentTraceEntry } from '@/types'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7071'

// Agent endpoint can be toggled independently of the CRUD mock
const USE_MOCK_AGENT = import.meta.env.VITE_USE_MOCK_AGENT !== 'false'
const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE_URL ?? API_BASE

// ─────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = 'flownote_notes'

function getAllNotes(): Record<string, NoteDetail> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function setAllNotes(data: Record<string, NoteDetail>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function delay(ms = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────

export async function listNotes(): Promise<NoteItem[]> {
  if (USE_MOCK) {
    await delay()
    const all = getAllNotes()
    return Object.values(all)
      .map(({ id, title, updatedAt, tags }) => ({ id, title, updatedAt, tags }))
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
  }
  const res = await fetch(`${API_BASE}/api/list`, { headers: authHeaders() })
  return res.json()
}

export async function loadNote(id: string): Promise<NoteDetail> {
  if (USE_MOCK) {
    await delay()
    const all = getAllNotes()
    const note = all[id]
    if (!note) throw new Error(`Note not found: ${id}`)
    return note
  }
  const res = await fetch(`${API_BASE}/api/load/${id}`, { headers: authHeaders() })
  return res.json()
}

export async function saveNote(data: {
  id: string
  title: string
  markdown: string
  tags?: string[]
}): Promise<NoteDetail> {
  if (USE_MOCK) {
    await delay()
    const all = getAllNotes()
    const now = new Date().toISOString()
    const note: NoteDetail = {
      id: data.id,
      title: data.title,
      markdown: data.markdown,
      tags: data.tags ?? [],
      updatedAt: now,
    }
    all[data.id] = note
    setAllNotes(all)
    return note
  }
  const res = await fetch(`${API_BASE}/api/save`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteNote(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay()
    const all = getAllNotes()
    delete all[id]
    setAllNotes(all)
    return
  }
  await fetch(`${API_BASE}/api/delete/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}

// ─────────────────────────────────────────────
// Agent chat
// ─────────────────────────────────────────────

export async function agentChat(payload: {
  noteId: string
  message: string
  context: {
    markdown: string
    selection: { nodeIds: string[]; edgeIds: string[] }
    metadata: unknown
    systemPrompt?: string
    templateId?: string
  }
}): Promise<Suggestion> {
  if (USE_MOCK_AGENT) {
    await delay(1200)
    return mockAgentResponse(payload.message, payload.context.markdown)
  }

  const res = await fetch(`${AGENT_API_BASE}/api/agent/chat`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Agent API error ${res.status}`)
  }
  return res.json()
}

// ─────────────────────────────────────────────
// Negotiate (SignalR)
// ─────────────────────────────────────────────

export async function negotiate(): Promise<{ url: string; accessToken?: string }> {
  if (USE_MOCK) {
    return { url: '' } // mock – no real SignalR
  }
  const res = await fetch(`${API_BASE}/api/negotiate`, { headers: authHeaders() })
  return res.json()
}

// ─────────────────────────────────────────────
// Auth header helper
// ─────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('msal_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─────────────────────────────────────────────
// Mock agent response generator
// ─────────────────────────────────────────────

function mockAgentResponse(message: string, currentMarkdown: string): Suggestion {
  const suggestionId = uuidv4()
  const lower = message.toLowerCase()
  const now = new Date().toISOString()

  // Detect intent and produce a relevant mock markdown
  if (lower.includes('追加') || lower.includes('add') || lower.includes('ノード')) {
    const newMd = insertExtraNode(currentMarkdown)
    const trace: AgentTraceEntry[] = [
      { seq: 1, type: 'tool_call', tool: 'add_node', args: { node_id: 'review', label: 'レビュー', node_type: 'default' }, result: "Added default node 'review' (レビュー).", durationMs: 4, timestamp: now },
      { seq: 2, type: 'tool_call', tool: 'add_edge', args: { source: 'process', target: 'review', label: '' }, result: 'Added edge process → review.', durationMs: 2, timestamp: now },
      { seq: 3, type: 'tool_call', tool: 'add_edge', args: { source: 'review', target: 'end', label: '' }, result: 'Added edge review → end.', durationMs: 2, timestamp: now },
    ]
    return {
      suggestionId,
      markdown: newMd,
      summary: 'レビューノードを追加しました。フロー中間にレビューステップを挿入しています。',
      impacts: { nodesDelta: 1, edgesDelta: 2, changedNodeIds: ['review'], changedEdgeIds: ['e-review-1', 'e-review-2'] },
      agentTrace: trace,
      executionMs: 1234,
    }
  }

  if (lower.includes('シンプル') || lower.includes('simple') || lower.includes('簡単')) {
    const trace: AgentTraceEntry[] = [
      { seq: 1, type: 'tool_call', tool: 'replace_flow', args: { nodes_count: 3, edges_count: 2 }, result: 'Replaced flow: 3 nodes, 2 edges.', durationMs: 8, timestamp: now },
    ]
    return {
      suggestionId,
      markdown: SIMPLE_FLOW,
      summary: 'フローをシンプルな3ステップ構成に変更しました。',
      impacts: { nodesDelta: -2, edgesDelta: -1, changedNodeIds: [], changedEdgeIds: [] },
      agentTrace: trace,
      executionMs: 987,
    }
  }

  if (lower.includes('並行') || lower.includes('parallel')) {
    const trace: AgentTraceEntry[] = [
      { seq: 1, type: 'tool_call', tool: 'add_node', args: { node_id: 'processA', label: '処理A', node_type: 'default' }, result: "Added default node 'processA' (処理A).", durationMs: 3, timestamp: now },
      { seq: 2, type: 'tool_call', tool: 'add_node', args: { node_id: 'processB', label: '処理B', node_type: 'default' }, result: "Added default node 'processB' (処理B).", durationMs: 3, timestamp: now },
      { seq: 3, type: 'tool_call', tool: 'add_node', args: { node_id: 'merge', label: '統合', node_type: 'default' }, result: "Added default node 'merge' (統合).", durationMs: 2, timestamp: now },
      { seq: 4, type: 'tool_call', tool: 'add_edge', args: { source: 'start', target: 'processA', label: '' }, result: 'Added edge start → processA.', durationMs: 2, timestamp: now },
      { seq: 5, type: 'tool_call', tool: 'add_edge', args: { source: 'start', target: 'processB', label: '' }, result: 'Added edge start → processB.', durationMs: 2, timestamp: now },
    ]
    return {
      suggestionId,
      markdown: PARALLEL_FLOW,
      summary: '並行処理フローに変更しました。2つの処理を同時に実行する構成です。',
      impacts: { nodesDelta: 2, edgesDelta: 3, changedNodeIds: ['processA', 'processB'], changedEdgeIds: [] },
      agentTrace: trace,
      executionMs: 1567,
    }
  }

  // Generic response
  return {
    suggestionId,
    markdown: currentMarkdown,
    summary: `「${message}」について: 現在のフローが最適な構成です。変更は不要です。`,
    impacts: { nodesDelta: 0, edgesDelta: 0, changedNodeIds: [], changedEdgeIds: [] },
    agentTrace: [],
    executionMs: 800,
  }
}

function insertExtraNode(markdown: string): string {
  // Naive insertion – finds the first "->" and inserts a review step
  if (markdown.includes('review')) return markdown
  return markdown.replace(
    /(\[process\] -> \(\(end\)\))/,
    '[process] -> [review]\n[review] -> ((end))\n[review] レビュー'
  ) + '\n[review] レビュー'
}

const SIMPLE_FLOW = `# シンプルフロー

\`\`\`flow
[[start]] 開始
[step] ステップ
((end)) 終了

[[start]] -> [step]
[step] -> ((end))
\`\`\`
`

const PARALLEL_FLOW = `# 並行処理フロー

\`\`\`flow
[[start]] 開始
[processA] 処理A
[processB] 処理B
[merge] 統合
((end)) 終了

[[start]] -> [processA]
[[start]] -> [processB]
[processA] -> [merge]
[processB] -> [merge]
[merge] -> ((end))
\`\`\`
`
