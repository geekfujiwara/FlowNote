import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'
import type {
  NoteItem,
  NoteDetail,
  ChatMessage,
  AgentStatus,
  Suggestion,
  CanvasMode,
  LastAppliedChange,
  FlowNodeData,
  VersionEntry,
} from '@/types'
import { parseFlowFromMarkdown } from '@/lib/flowParser'
import { trackEvent } from '@/lib/appInsights'
import { getTemplateById } from '@/lib/templates'
import { applyDagreLayout } from '@/lib/dagLayout'
import * as mockApi from '@/lib/mockApi'
import { v4 as uuidv4 } from 'uuid'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEFAULT_MARKDOWN = `# 新しいフロー

\`\`\`flow
[[start]] 開始
[process] 処理
((end)) 終了

[start] -> [process]
[process] -> [end]
\`\`\`
`

// ─────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────

export interface FlowNoteState {
  // Notes
  notes: NoteItem[]
  currentNote: NoteItem | null

  // Content
  markdown: string
  nodes: Node<FlowNodeData>[]
  edges: Edge[]

  // Chat
  chatMessages: ChatMessage[]
  agentStatus: AgentStatus
  pendingSuggestion: Suggestion | null

  // Version history
  versionHistory: VersionEntry[]

  // Canvas UI
  canvasMode: CanvasMode
  selectedNodeIds: string[]
  selectedEdgeIds: string[]

  // Template
  activeTemplateId: string | null
  systemPrompt: string

  // Animations
  animateOnUpdate: boolean
  lastAppliedChange: LastAppliedChange | null

  // Async flags
  isSaving: boolean
  isConnected: boolean
  sidebarOpen: boolean

  // ─── Actions ─────────────────────────────

  // Markdown / flow
  setMarkdown: (md: string, source?: LastAppliedChange['source']) => void
  parseAndLayout: (md: string) => { nodes: Node<FlowNodeData>[]; edges: Edge[] }

  // Notes CRUD
  listNotes: () => Promise<void>
  loadNote: (id: string) => Promise<void>
  saveNote: () => Promise<void>
  deleteNote: (id: string) => Promise<void>
  newNote: () => void

  // Agent / Chat
  sendMessageToAgent: (message: string) => Promise<void>
  applySuggestion: () => void
  discardSuggestion: () => void
  clearChatMessages: () => void

  // Version history
  saveVersion: (label: string) => void
  restoreVersion: (id: string) => void
  clearVersionHistory: () => void

  // Tags
  setTags: (tags: string[]) => Promise<void>

  // Template
  applyTemplate: (templateId: string) => void
  setSystemPrompt: (prompt: string) => void

  // Canvas editing
  applyCanvasEdit: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void
  setCanvasMode: (mode: CanvasMode) => void
  setSelection: (nodeIds: string[], edgeIds: string[]) => void

  // Realtime
  onRemoteUpdate: (noteId: string) => Promise<void>
  setIsConnected: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useStore = create<FlowNoteState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    notes: [],
    currentNote: null,
    markdown: DEFAULT_MARKDOWN,
    nodes: [],
    edges: [],
    chatMessages: [],
    agentStatus: 'idle',
    pendingSuggestion: null,
    versionHistory: [],
    canvasMode: 'select',
    selectedNodeIds: [],
    selectedEdgeIds: [],
    animateOnUpdate: true,
    lastAppliedChange: null,
    isSaving: false,
    isConnected: false,
    sidebarOpen: true,
    activeTemplateId: null,
    systemPrompt: '',

    // ─── parseAndLayout ─────────────────────
    parseAndLayout: (md) => {
      const parsed = parseFlowFromMarkdown(md)
      const { nodes, edges } = applyDagreLayout(parsed)
      return { nodes, edges }
    },

    // ─── setMarkdown ────────────────────────
    setMarkdown: (md, source = 'user') => {
      const { parseAndLayout, lastAppliedChange } = get()
      const { nodes, edges } = parseAndLayout(md)

      // Compute changed ids for animation
      const prevNodes = get().nodes
      const prevEdges = get().edges
      const prevNodeIds = new Set(prevNodes.map((n) => n.id))
      const prevEdgeIds = new Set(prevEdges.map((e) => e.id))
      const changedNodeIds = nodes
        .filter((n) => !prevNodeIds.has(n.id))
        .map((n) => n.id)
      const changedEdgeIds = edges
        .filter((e) => !prevEdgeIds.has(e.id))
        .map((e) => e.id)

      // Mark changed nodes with animation data
      const animatedNodes = nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isChanged: changedNodeIds.includes(n.id),
          changeSource: source,
        },
      }))

      set({
        markdown: md,
        nodes: animatedNodes,
        edges,
        lastAppliedChange: {
          source,
          changedNodeIds,
          changedEdgeIds,
        },
      })

      // Clear animation marks after 2s
      setTimeout(() => {
        set((s) => ({
          nodes: s.nodes.map((n) => ({
            ...n,
            data: { ...n.data, isChanged: false },
          })),
        }))
      }, 2000)
    },

    // ─── listNotes ──────────────────────────
    listNotes: async () => {
      const notes = await mockApi.listNotes()
      set({ notes })
    },

    // ─── loadNote ───────────────────────────
    loadNote: async (id) => {
      const detail: NoteDetail = await mockApi.loadNote(id)
      const { parseAndLayout } = get()
      const { nodes, edges } = parseAndLayout(detail.markdown)
      set({
        currentNote: { id: detail.id, title: detail.title, updatedAt: detail.updatedAt, tags: detail.tags },
        markdown: detail.markdown,
        nodes,
        edges,
        chatMessages: [],
        pendingSuggestion: null,
        lastAppliedChange: null,
      })
    },

    // ─── saveNote ───────────────────────────
    saveNote: async () => {
      const { currentNote, markdown } = get()
      if (!currentNote) return

      set({ isSaving: true })
      try {
        const titleLine = markdown.split('\n').find((l) => l.startsWith('# '))
        const title = titleLine ? titleLine.replace(/^#\s+/, '') : currentNote.title
        await mockApi.saveNote({ id: currentNote.id, title, markdown })
        set((s) => ({
          currentNote: { ...s.currentNote!, title, updatedAt: new Date().toISOString() },
        }))
        await get().listNotes()
        trackEvent('note_saved', { noteId: currentNote.id, title })
      } finally {
        set({ isSaving: false })
      }
    },

    // ─── deleteNote ─────────────────────────
    deleteNote: async (id) => {
      await mockApi.deleteNote(id)
      const { currentNote } = get()
      if (currentNote?.id === id) {
        set({ currentNote: null, markdown: DEFAULT_MARKDOWN, nodes: [], edges: [] })
      }
      await get().listNotes()
    },

    // ─── newNote ────────────────────────────
    newNote: () => {
      const id = uuidv4()
      const now = new Date().toISOString()
      const note: NoteItem = { id, title: '新しいノート', updatedAt: now }
      set({
        currentNote: note,
        markdown: DEFAULT_MARKDOWN,
        nodes: [],
        edges: [],
        chatMessages: [],
        pendingSuggestion: null,
        lastAppliedChange: null,
      })
      const { parseAndLayout } = get()
      const { nodes, edges } = parseAndLayout(DEFAULT_MARKDOWN)
      set({ nodes, edges })
      // Persist immediately so the note survives a page reload
      mockApi.saveNote({ id, title: '新しいノート', markdown: DEFAULT_MARKDOWN }).then(() => {
        get().listNotes()
      })
      trackEvent('note_created')
    },

    // ─── sendMessageToAgent ─────────────────
    sendMessageToAgent: async (message) => {
      const { currentNote, markdown, selectedNodeIds, selectedEdgeIds } = get()
      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }
      set((s) => ({
        chatMessages: [...s.chatMessages, userMsg],
        agentStatus: 'thinking',
      }))

      try {
        const suggestion = await mockApi.agentChat({
          noteId: currentNote?.id ?? '',
          message,
          context: {
            markdown,
            selection: { nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds },
            metadata: currentNote,
            systemPrompt: get().systemPrompt || undefined,
            templateId: get().activeTemplateId || undefined,
          },
        })

        const agentMsg: ChatMessage = {
          id: uuidv4(),
          role: 'agent',
          content: suggestion.summary,
          timestamp: new Date().toISOString(),
          agentTrace: suggestion.agentTrace,
          executionMs: suggestion.executionMs,
        }
        set((s) => ({
          chatMessages: [...s.chatMessages, agentMsg],
          agentStatus: 'idle',
          pendingSuggestion: suggestion,
        }))
        trackEvent('agent_message_sent', { message: message.slice(0, 80) })
      } catch {
        const errMsg: ChatMessage = {
          id: uuidv4(),
          role: 'agent',
          content: 'エラーが発生しました。もう一度お試しください。',
          timestamp: new Date().toISOString(),
        }
        set((s) => ({
          chatMessages: [...s.chatMessages, errMsg],
          agentStatus: 'error',
        }))
      }
    },

    // ─── applySuggestion ────────────────────
    applySuggestion: () => {
      const { pendingSuggestion, setMarkdown, saveVersion, markdown, nodes, edges } = get()
      if (!pendingSuggestion) return

      // Snapshot current state before applying
      saveVersion('変更前の状態を保存')

      const newMd = pendingSuggestion.markdown ?? markdown
      setMarkdown(newMd, 'agent')
      set({ pendingSuggestion: null })

      // Snapshot after applying
      const summary = pendingSuggestion.summary.slice(0, 40)
      const after = get()
      const entry: VersionEntry = {
        id: uuidv4(),
        label: `AI: ${summary}`,
        timestamp: new Date().toISOString(),
        markdown: newMd,
        nodeCount: after.nodes.length,
        edgeCount: after.edges.length,
      }
      set((s) => ({ versionHistory: [entry, ...s.versionHistory].slice(0, 50) }))
      trackEvent('suggestion_applied', { summary })
    },

    // ─── saveVersion ───────────────────────
    saveVersion: (label) => {
      const { markdown, nodes, edges } = get()
      const entry: VersionEntry = {
        id: uuidv4(),
        label,
        timestamp: new Date().toISOString(),
        markdown,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      }
      set((s) => ({ versionHistory: [entry, ...s.versionHistory].slice(0, 50) }))
    },

    // ─── restoreVersion ───────────────────
    restoreVersion: (id) => {
      const { versionHistory, setMarkdown, saveVersion } = get()
      const entry = versionHistory.find((v) => v.id === id)
      if (!entry) return
      // Snapshot current state before restoring
      saveVersion('復元前の状態を保存')
      setMarkdown(entry.markdown, 'user')
    },

    // ─── clearVersionHistory ────────────────
    clearVersionHistory: () => {
      set({ versionHistory: [] })
    },

    // ─── discardSuggestion ──────────────────
    discardSuggestion: () => {
      set({ pendingSuggestion: null })
    },

    // ─── clearChatMessages ──────────────────
    clearChatMessages: () => {
      set({ chatMessages: [], pendingSuggestion: null, agentStatus: 'idle' })
    },

    // ─── setTags ────────────────────────────
    setTags: async (tags) => {
      const { currentNote, markdown } = get()
      if (!currentNote) return
      set((s) => ({
        currentNote: s.currentNote ? { ...s.currentNote, tags } : null,
      }))
      const titleLine = markdown.split('\n').find((l) => l.startsWith('# '))
      const title = titleLine ? titleLine.replace(/^#\s+/, '') : currentNote.title
      await mockApi.saveNote({ id: currentNote.id, title, markdown, tags })
      await get().listNotes()
    },

    // ─── applyCanvasEdit ────────────────────
    applyCanvasEdit: (nodes, edges) => {
      // Convert canvas → Markdown (canonical sync)
      const md = canvasToMarkdown(nodes, edges)
      set({ nodes, edges, markdown: md })
    },

    // ─── setCanvasMode ──────────────────────
    setCanvasMode: (mode) => set({ canvasMode: mode }),

    // ─── setSelection ───────────────────────
    setSelection: (nodeIds, edgeIds) =>
      set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),

    // ─── onRemoteUpdate ─────────────────────
    onRemoteUpdate: async (noteId) => {
      const { currentNote, loadNote } = get()
      if (currentNote?.id === noteId) {
        await loadNote(noteId)
        set((s) => ({
          lastAppliedChange: {
            source: 'remote',
            changedNodeIds: s.nodes.map((n) => n.id),
            changedEdgeIds: s.edges.map((e) => e.id),
          },
        }))
      }
    },

    setIsConnected: (v) => set({ isConnected: v }),
    setSidebarOpen: (v) => set({ sidebarOpen: v }),

    // ─── setSystemPrompt ────────────────────
    setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

    // ─── applyTemplate ──────────────────────
    applyTemplate: (templateId) => {
      const template = getTemplateById(templateId)
      if (!template) return

      const { parseAndLayout, newNote } = get()
      newNote()

      // Overwrite markdown and graph with template's initial content
      const md = template.initialMarkdown
      const { nodes, edges } = parseAndLayout(md)

      set({
        markdown: md,
        nodes,
        edges,
        chatMessages: [],
        pendingSuggestion: null,
        activeTemplateId: templateId,
        systemPrompt: template.systemPrompt,
      })

      // Persist the new note with template content
      const { currentNote } = get()
      if (currentNote) {
        mockApi.saveNote({
          id: currentNote.id,
          title: template.name,
          markdown: md,
        }).then(() => get().listNotes())
      }

      trackEvent('template_applied', { templateId, templateName: template.name })
    },
  }))
)

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Reconstruct Markdown flow block from canvas nodes/edges.
 * This is called when the user edits the canvas directly.
 */
function canvasToMarkdown(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): string {
  const nodelines = nodes.map((n) => {
    const { nodeType, label } = n.data
    const id = n.id
    switch (nodeType) {
      case 'input':    return `[[${id}]] ${label}`
      case 'output':   return `((${id})) ${label}`
      case 'selector': return `{${id}} ${label}`
      default:         return `[${id}] ${label}`
    }
  })

  const edgelines = edges.map((e) => {
    const base = `[${e.source}] -> [${e.target}]`
    return e.label ? `${base} : ${e.label}` : base
  })

  const flowBlock =
    '```flow\n' +
    [...nodelines, '', ...edgelines].join('\n') +
    '\n```'

  return flowBlock
}
