# FlowNote - Unified Design & Build Prompt

Project: FlowNote

Purpose:
FlowNote is a Web application that allows authenticated users to co-create flowcharts by combining:
- Markdown-based authoring
- Direct canvas editing using @xyflow/react
- A conversational UI powered by an Agent Framework agent

Users can interact with an agent while editing, request changes, and apply agent-generated updates.
All applied updates synchronize Markdown and canvas state, and are visualized with clear animations.

================================================================================
1. Core UX Overview
================================================================================

After login, the main UI is displayed with the following layout:

- Left: Sidebar
  - Note list
  - Search / filter
- Center: Markdown Editor
  - CodeMirror-based editor
  - Toolbar with icon-based actions (save, format, undo/redo)
- Right: Flow Canvas
  - Interactive flowchart rendered with @xyflow/react
  - Nodes and edges editable directly on the canvas
- Overlay or right-bottom: ChatPanel
  - Conversational UI for interacting with the agent

All major UI elements MUST include icons:
- Navigation items
- Buttons
- Toolbars
- Status indicators
- Empty states

Users can:
- Edit Markdown → flow updates automatically
- Edit flow on canvas → Markdown is updated (Markdown is the canonical source)
- Ask the agent to modify the flow
- Preview agent suggestions and apply or discard them
- See all updates animated and highlighted

================================================================================
2. Technical Stack (Fixed)
================================================================================

Frontend:
- React 19
- TypeScript 5
- Vite 6
- @xyflow/react 12
- @uiw/react-codemirror 4
- unified + remark (Markdown parsing)
- dagre (auto layout)
- Zustand 5 (state management)
- Tailwind CSS 4 (styling)
- @azure/msal-browser 3 (Entra ID auth)
- @microsoft/signalr 8 (realtime)

Backend:
- Azure Functions (Python 3.11, Functions v2 programming model)
- Agent Framework (agent-framework-azure-ai)
- Azure Blob Storage (Managed Identity via DefaultAzureCredential)
- Azure SignalR Service
- Event Grid (Blob change notifications)

Storage:
- flownotes/{oid}/{uuid}.md           (Markdown body)
- flownotes-meta/{oid}/{uuid}.json    (metadata)

Frontend MUST NOT access Blob Storage directly.
All storage operations go through Functions APIs.

================================================================================
3. Flow Markdown Specification
================================================================================

Flow definitions are written inside code blocks with lang="flow".

Syntax:

[NodeId] Node Label
[NodeA] -> [NodeB]
[NodeA] -> [NodeB] : Edge Label

Node types:
- [id]        default
- [[id]]      input (start)
- ((id))      output (end)
- {id}        selector (decision)

Parsing pipeline:
Markdown
  -> extract ```flow blocks
  -> parse nodes/edges
  -> auto layout with dagre
  -> render with @xyflow/react

================================================================================
4. UI Components (Minimum Set)
================================================================================

- AppLayout
  - Sidebar
  - Editor
  - Canvas
  - ChatPanel

- Sidebar
  - NoteList
  - NoteItem

- Editor
  - MarkdownEditor (CodeMirror)
  - SaveButton (icon)
  - EditorToolbar (icons)

- Canvas
  - FlowChart wrapper
  - CustomNode (icon + label)
  - CustomEdge

- ChatPanel
  - Message list (user / agent)
  - Input + send button (icon)
  - Suggestion preview
  - Apply / Discard / Regenerate (icons)

- SuggestionCard
  - Summary
  - Impacts (nodesDelta / edgesDelta)
  - Diff or patch preview

- FlowMetadataPanel
  - Title
  - Tags
  - Node/edge count
  - UpdatedAt

- CanvasEditToolbar
  - Add node
  - Connect
  - Align
  - Zoom
  - Undo / Redo
  (all icon-based)

================================================================================
5. State Model (Zustand)
================================================================================

State must include:

- notes: NoteItem[]
- currentNote: NoteItem | null

- markdown: string              // canonical source of truth
- flow: { nodes; edges }        // parsed + laid out

- chatMessages: ChatMessage[]
- agentStatus: idle | thinking | error
- pendingSuggestion:
  - suggestionId
  - markdownPatch or full markdown
  - summary
  - impacts { nodesDelta; edgesDelta }

- canvasMode: select | edit
- selection { nodeIds; edgeIds }

- animateOnUpdate: boolean
- lastAppliedChange:
  - source: user | agent | remote
  - changedNodeIds
  - changedEdgeIds

- isSaving
- isConnected (SignalR)

Actions must include:
- setMarkdown
- parseAndLayout
- saveNote / loadNote / listNotes
- sendMessageToAgent
- applySuggestion / discardSuggestion
- applyCanvasEdit (sync canvas → Markdown)
- onRemoteUpdate

================================================================================
6. Agent Interaction Flow
================================================================================

User sends message via ChatPanel
  -> POST /api/agent/chat
  -> Agent Framework processes request
  -> Response includes:
       - summary
       - markdownPatch or full markdown
       - impacts (node/edge delta)

UI behavior:
- Show suggestion preview
- User chooses Apply or Discard

On Apply:
- Update markdown
- Re-parse and re-layout
- Update canvas
- Animate changes and highlight affected nodes/edges

================================================================================
7. Canvas Editing Rules
================================================================================

- Canvas edits are allowed:
  - Move nodes
  - Add/remove nodes or edges
  - Edit labels

- All canvas edits MUST be converted back into Markdown
- Markdown remains the canonical representation
- After sync:
  - Re-parse
  - Re-render canvas
  - Apply minimal animations

================================================================================
8. Realtime Updates (SignalR)
================================================================================

- Blob create/update triggers Event Grid
- Functions notify SignalR
- Clients receive noteUpdated event
- If current note is affected:
  - Reload Markdown
  - Re-render flow
  - Animate changes
  - Mark source as remote

================================================================================
9. Animations (Required)
================================================================================

All visual updates must be animated:

- Node add: fade + slight scale in
- Node remove: fade out
- Edge add/remove: draw/erase transition
- Layout changes: smooth position transitions
- Changed elements: temporary highlight outline
- Source-based styling:
  - agent changes
  - user changes
  - remote changes

================================================================================
10. APIs (Summary)
================================================================================

Existing:
- POST   /api/save
- GET    /api/list
- GET    /api/load/{id}
- DELETE /api/delete/{id}
- GET    /api/negotiate
- POST   /api/notify (internal)

Add:
- POST /api/agent/chat
  Input:
    - noteId
    - message
    - context { markdown; selection; metadata }
  Output:
    - suggestionId
    - summary
    - markdownPatch or markdown
    - impacts

================================================================================
11. Authentication & Security
================================================================================

- Entra ID OAuth2
- MSAL in frontend
- Authorization: Bearer token on all APIs
- Extract oid claim in Functions
- Enforce write/delete only to owner path
- Blob access via Managed Identity only

================================================================================
12. Implementation Order (Start Here)
================================================================================

1. Scaffold frontend (Vite + React + TS)
2. Setup Tailwind + icon system
3. Implement AuthGuard + MSAL login
4. Setup Zustand store (full model above)
5. Implement Markdown editor + flow parser + canvas view
6. Implement save/load/list/delete
7. Implement SignalR negotiate + client hook
8. Implement ChatPanel + agent API integration
9. Implement canvas editing + Markdown sync
10. Add animations + change highlighting

================================================================================
End of Prompt
================================================================================
