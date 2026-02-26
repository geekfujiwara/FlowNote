import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { NoteItem, ChatMessage, PendingSuggestion } from '../types'
import { parseFlowMarkdown } from '../utils/flowParser'
import { flowToMarkdown } from '../utils/flowToMarkdown'

interface FlowState {
  nodes: Node[]
  edges: Edge[]
}

interface LastAppliedChange {
  source: 'user' | 'agent' | 'remote'
  changedNodeIds: string[]
  changedEdgeIds: string[]
}

interface Selection {
  nodeIds: string[]
  edgeIds: string[]
}

interface AppState {
  notes: NoteItem[]
  currentNote: NoteItem | null
  markdown: string
  flow: FlowState
  chatMessages: ChatMessage[]
  agentStatus: 'idle' | 'thinking' | 'error'
  pendingSuggestion: PendingSuggestion | null
  canvasMode: 'select' | 'edit'
  selection: Selection
  animateOnUpdate: boolean
  lastAppliedChange: LastAppliedChange | null
  isSaving: boolean
  isConnected: boolean

  setMarkdown: (md: string) => void
  parseAndLayout: () => void
  saveNote: (getToken: () => Promise<string>) => Promise<void>
  loadNote: (id: string, getToken: () => Promise<string>) => Promise<void>
  listNotes: (getToken: () => Promise<string>) => Promise<void>
  deleteNote: (id: string, getToken: () => Promise<string>) => Promise<void>
  sendMessageToAgent: (message: string, getToken: () => Promise<string>) => Promise<void>
  applySuggestion: () => void
  discardSuggestion: () => void
  applyCanvasEdit: (nodes: Node[], edges: Edge[]) => void
  onRemoteUpdate: (noteId: string, getToken: () => Promise<string>) => void
  setCanvasMode: (mode: 'select' | 'edit') => void
  setSelection: (nodeIds: string[], edgeIds: string[]) => void
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function apiFetch(path: string, options: RequestInit, getToken: () => Promise<string>) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const useAppStore = create<AppState>((set, get) => ({
  notes: [],
  currentNote: null,
  markdown: '',
  flow: { nodes: [], edges: [] },
  chatMessages: [],
  agentStatus: 'idle',
  pendingSuggestion: null,
  canvasMode: 'select',
  selection: { nodeIds: [], edgeIds: [] },
  animateOnUpdate: true,
  lastAppliedChange: null,
  isSaving: false,
  isConnected: false,

  setMarkdown: (md) => {
    set({ markdown: md })
    get().parseAndLayout()
  },

  parseAndLayout: () => {
    const { markdown } = get()
    const { nodes, edges } = parseFlowMarkdown(markdown)
    set({ flow: { nodes, edges } })
  },

  saveNote: async (getToken) => {
    const { currentNote, markdown } = get()
    set({ isSaving: true })
    try {
      const data = await apiFetch(
        '/api/save',
        {
          method: 'POST',
          body: JSON.stringify({
            id: currentNote?.id,
            title: currentNote?.title || 'Untitled',
            markdown,
            tags: currentNote?.tags || [],
          }),
        },
        getToken
      )
      set({ currentNote: data, isSaving: false })
    } catch {
      set({ isSaving: false })
    }
  },

  loadNote: async (id, getToken) => {
    try {
      const data = await apiFetch(`/api/load/${id}`, { method: 'GET' }, getToken)
      set({ currentNote: data, markdown: data.markdown || '' })
      get().parseAndLayout()
    } catch {
      // ignore
    }
  },

  listNotes: async (getToken) => {
    try {
      const data = await apiFetch('/api/list', { method: 'GET' }, getToken)
      set({ notes: data })
    } catch {
      // ignore
    }
  },

  deleteNote: async (id, getToken) => {
    try {
      await apiFetch(`/api/delete/${id}`, { method: 'DELETE' }, getToken)
      set((s) => ({
        notes: s.notes.filter((n) => n.id !== id),
        currentNote: s.currentNote?.id === id ? null : s.currentNote,
        markdown: s.currentNote?.id === id ? '' : s.markdown,
        flow: s.currentNote?.id === id ? { nodes: [], edges: [] } : s.flow,
      }))
    } catch {
      // ignore
    }
  },

  sendMessageToAgent: async (message, getToken) => {
    const { currentNote, markdown, selection, chatMessages } = get()
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    set({ chatMessages: [...chatMessages, userMsg], agentStatus: 'thinking' })

    try {
      const data = await apiFetch(
        '/api/agent/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            noteId: currentNote?.id,
            message,
            context: {
              markdown,
              selection,
              metadata: currentNote
                ? { title: currentNote.title, tags: currentNote.tags, updatedAt: currentNote.updatedAt }
                : undefined,
            },
          }),
        },
        getToken
      )
      const agentMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: data.summary || data.message || data.content || 'Done.',
        timestamp: new Date().toISOString(),
      }
      const suggestion: PendingSuggestion | null =
        data.suggestionId
          ? {
              suggestionId: data.suggestionId,
              summary: data.summary || '',
              ...(data.markdown !== undefined && { markdown: data.markdown as string }),
              ...(data.markdownPatch !== undefined && { markdownPatch: data.markdownPatch as string }),
              impacts: data.impacts || { nodesDelta: 0, edgesDelta: 0 },
            }
          : null
      set((s) => ({
        chatMessages: [...s.chatMessages, agentMsg],
        agentStatus: 'idle',
        pendingSuggestion: suggestion,
      }))
    } catch {
      const mockMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: 'I can help you build your flowchart! (API not connected - mock response)',
        timestamp: new Date().toISOString(),
      }
      set((s) => ({
        chatMessages: [...s.chatMessages, mockMsg],
        agentStatus: 'idle',
      }))
    }
  },

  applySuggestion: () => {
    const { pendingSuggestion } = get()
    if (!pendingSuggestion) return
    if (pendingSuggestion.markdown) {
      get().setMarkdown(pendingSuggestion.markdown)
    }
    set({ pendingSuggestion: null, lastAppliedChange: { source: 'agent', changedNodeIds: [], changedEdgeIds: [] } })
  },

  discardSuggestion: () => {
    set({ pendingSuggestion: null })
  },

  applyCanvasEdit: (nodes, edges) => {
    const flowMd = flowToMarkdown(nodes, edges)
    const { markdown } = get()
    const updated = markdown.includes('```flow')
      ? markdown.replace(/```flow[\s\S]*?```/, flowMd)
      : markdown + '\n\n' + flowMd
    set({ markdown: updated, flow: { nodes, edges } })
  },

  onRemoteUpdate: (noteId, getToken) => {
    const { currentNote } = get()
    if (currentNote?.id === noteId) {
      get().loadNote(noteId, getToken)
    }
  },

  setCanvasMode: (mode) => set({ canvasMode: mode }),

  setSelection: (nodeIds, edgeIds) => set({ selection: { nodeIds, edgeIds } }),
}))
