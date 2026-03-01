import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useStore } from '@/store/useStore'

// Helper: reset store to initial state before each test
function resetStore() {
  useStore.setState({
    notes: [],
    currentNote: null,
    markdown: '',
    nodes: [],
    edges: [],
    chatMessages: [],
    agentStatus: 'idle',
    pendingSuggestion: null,
    agentLogs: [],
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
    versionHistory: [],
  })
  localStorage.clear()
}

describe('useStore – setMarkdown / parseAndLayout', () => {
  beforeEach(resetStore)

  it('setMarkdown で markdown が更新される', () => {
    act(() => {
      useStore.getState().setMarkdown('# Hello')
    })
    expect(useStore.getState().markdown).toBe('# Hello')
  })

  it('flow ブロックを含む Markdown を解析してノードを生成する', () => {
    act(() => {
      useStore.getState().setMarkdown('```flow\n[[s]] 開始\n[p] 処理\n((e)) 終了\n\n[s] -> [p]\n[p] -> [e]\n```')
    })
    const { nodes, edges } = useStore.getState()
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
  })

  it('source が agent の場合、lastAppliedChange.source が "agent" になる', () => {
    act(() => {
      useStore.getState().setMarkdown('# Test', 'agent')
    })
    expect(useStore.getState().lastAppliedChange?.source).toBe('agent')
  })

  it('source が remote の場合、lastAppliedChange.source が "remote" になる', () => {
    act(() => {
      useStore.getState().setMarkdown('# Test', 'remote')
    })
    expect(useStore.getState().lastAppliedChange?.source).toBe('remote')
  })

  it('新しいノード ID が changedNodeIds に含まれる', () => {
    // First set without any nodes
    act(() => {
      useStore.getState().setMarkdown('# Empty')
    })
    // Then add a node
    act(() => {
      useStore.getState().setMarkdown('```flow\n[new] 新ノード\n```')
    })
    expect(useStore.getState().lastAppliedChange?.changedNodeIds).toContain('new')
  })
})

describe('useStore – newNote', () => {
  beforeEach(resetStore)

  it('newNote で currentNote が設定される', () => {
    act(() => {
      useStore.getState().newNote()
    })
    expect(useStore.getState().currentNote).not.toBeNull()
  })

  it('newNote で markdown がデフォルト値に設定される', () => {
    act(() => {
      useStore.getState().newNote()
    })
    expect(useStore.getState().markdown).toContain('flow')
  })

  it('newNote でチャットメッセージがリセットされる', () => {
    act(() => {
      useStore.setState({ chatMessages: [{ id: '1', role: 'user', content: 'x', timestamp: '' }] })
      useStore.getState().newNote()
    })
    expect(useStore.getState().chatMessages).toHaveLength(0)
  })
})

describe('useStore – saveNote / loadNote / listNotes', () => {
  beforeEach(resetStore)

  it('saveNote → listNotes でノートが一覧に現れる', async () => {
    act(() => {
      useStore.getState().newNote()
    })
    await act(async () => {
      await useStore.getState().saveNote()
    })
    await act(async () => {
      await useStore.getState().listNotes()
    })
    expect(useStore.getState().notes.length).toBeGreaterThan(0)
  })

  it('saveNote で isSaving が true → false に遷移する', async () => {
    act(() => { useStore.getState().newNote() })
    const promise = act(async () => {
      await useStore.getState().saveNote()
    })
    await promise
    expect(useStore.getState().isSaving).toBe(false)
  })

  it('loadNote で currentNote と markdown が更新される', async () => {
    // Save a note first
    const { saveNote, newNote, listNotes, loadNote } = useStore.getState()
    act(() => newNote())
    act(() => useStore.getState().setMarkdown('# ロードテスト\n```flow\n[a] A\n```'))
    await act(async () => { await saveNote() })
    await act(async () => { await listNotes() })
    const notes = useStore.getState().notes
    expect(notes.length).toBeGreaterThan(0)

    // Load it fresh
    act(() => useStore.setState({ markdown: '', nodes: [], edges: [] }))
    await act(async () => { await loadNote(notes[0].id) })
    expect(useStore.getState().markdown).toContain('ロードテスト')
  })
})

describe('useStore – deleteNote', () => {
  beforeEach(resetStore)

  it('削除後に currentNote が null になる（削除したノートが現在開いている場合）', async () => {
    act(() => useStore.getState().newNote())
    const id = useStore.getState().currentNote!.id
    await act(async () => { await useStore.getState().saveNote() })
    await act(async () => { await useStore.getState().deleteNote(id) })
    expect(useStore.getState().currentNote).toBeNull()
  })
})

describe('useStore – canvasMode / selection', () => {
  beforeEach(resetStore)

  it('setCanvasMode で canvasMode が変わる', () => {
    act(() => { useStore.getState().setCanvasMode('edit') })
    expect(useStore.getState().canvasMode).toBe('edit')
  })

  it('setSelection でノードとエッジの選択が更新される', () => {
    act(() => { useStore.getState().setSelection(['node-1', 'node-2'], ['edge-1']) })
    expect(useStore.getState().selectedNodeIds).toEqual(['node-1', 'node-2'])
    expect(useStore.getState().selectedEdgeIds).toEqual(['edge-1'])
  })
})

describe('useStore – suggestion (agent)', () => {
  beforeEach(resetStore)

  it('applySuggestion で pendingSuggestion が null になる', () => {
    act(() => {
      useStore.setState({
        pendingSuggestion: {
          suggestionId: 'sg1',
          markdown: '# Updated\n```flow\n[a] A\n```',
          summary: 'テスト提案',
          impacts: { nodesDelta: 1, edgesDelta: 0, changedNodeIds: [], changedEdgeIds: [] },
        },
      })
      useStore.getState().applySuggestion()
    })
    expect(useStore.getState().pendingSuggestion).toBeNull()
  })

  it('applySuggestion で markdown が suggestion の値に更新される', () => {
    const newMd = '# Updated\n```flow\n[x] Updated\n```'
    act(() => {
      useStore.setState({
        pendingSuggestion: {
          suggestionId: 'sg1',
          markdown: newMd,
          summary: '提案',
          impacts: { nodesDelta: 0, edgesDelta: 0, changedNodeIds: [], changedEdgeIds: [] },
        },
      })
      useStore.getState().applySuggestion()
    })
    expect(useStore.getState().markdown).toBe(newMd)
    expect(useStore.getState().lastAppliedChange?.source).toBe('agent')
  })

  it('discardSuggestion で pendingSuggestion が null になる', () => {
    act(() => {
      useStore.setState({
        pendingSuggestion: {
          suggestionId: 'sg2',
          summary: 'x',
          impacts: { nodesDelta: 0, edgesDelta: 0, changedNodeIds: [], changedEdgeIds: [] },
        },
      })
      useStore.getState().discardSuggestion()
    })
    expect(useStore.getState().pendingSuggestion).toBeNull()
  })
})

describe('useStore – sendMessageToAgent', () => {
  beforeEach(resetStore)

  it('ユーザーメッセージが chatMessages に追加される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('こんにちは')
    })
    const messages = useStore.getState().chatMessages
    expect(messages.some((m) => m.role === 'user' && m.content === 'こんにちは')).toBe(true)
  })

  it('エージェント応答が chatMessages に追加される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('テスト')
    })
    const messages = useStore.getState().chatMessages
    expect(messages.some((m) => m.role === 'agent')).toBe(true)
  })

  it('送信後に agentStatus が idle に戻る', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('テスト')
    })
    expect(useStore.getState().agentStatus).toBe('idle')
  })

  it('"追加" メッセージで pendingSuggestion が設定される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('ノードを追加して')
    })
    expect(useStore.getState().pendingSuggestion).not.toBeNull()
    expect(useStore.getState().pendingSuggestion!.impacts.nodesDelta).toBeGreaterThan(0)
  })
})

describe('useStore – agentLogs', () => {
  beforeEach(resetStore)

  it('初期状態で agentLogs は空配列', () => {
    expect(useStore.getState().agentLogs).toEqual([])
  })

  it('sendMessageToAgent 後に agentLogs に1件追加される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('ノードを追加して')
    })
    expect(useStore.getState().agentLogs).toHaveLength(1)
  })

  it('agentLogs エントリにユーザーメッセージが記録される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('テストメッセージ')
    })
    const log = useStore.getState().agentLogs[0]
    expect(log.message).toBe('テストメッセージ')
  })

  it('agentLogs エントリに requestPayload が含まれる', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('フローを変更して')
    })
    const log = useStore.getState().agentLogs[0]
    expect(log.requestPayload).toBeDefined()
    expect((log.requestPayload as { message: string }).message).toBe('フローを変更して')
  })

  it('成功時は agentLogs エントリに responsePayload が含まれる', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('説明して')
    })
    const log = useStore.getState().agentLogs[0]
    expect(log.responsePayload).not.toBeNull()
    expect(log.errorMessage).toBeUndefined()
  })

  it('agentLogs エントリに durationMs が記録される', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('テスト')
    })
    const log = useStore.getState().agentLogs[0]
    expect(log.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('複数回送信すると agentLogs が最新順に積まれる', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('1回目')
    })
    await act(async () => {
      await useStore.getState().sendMessageToAgent('2回目')
    })
    const logs = useStore.getState().agentLogs
    expect(logs).toHaveLength(2)
    expect(logs[0].message).toBe('2回目')  // newest first
    expect(logs[1].message).toBe('1回目')
  })

  it('clearAgentLogs で agentLogs が空になる', async () => {
    act(() => useStore.getState().newNote())
    await act(async () => {
      await useStore.getState().sendMessageToAgent('テスト')
    })
    expect(useStore.getState().agentLogs).toHaveLength(1)
    act(() => { useStore.getState().clearAgentLogs() })
    expect(useStore.getState().agentLogs).toEqual([])
  })
})

describe('useStore – setIsConnected / setSidebarOpen', () => {
  beforeEach(resetStore)

  it('setIsConnected で isConnected が変わる', () => {
    act(() => { useStore.getState().setIsConnected(true) })
    expect(useStore.getState().isConnected).toBe(true)
    act(() => { useStore.getState().setIsConnected(false) })
    expect(useStore.getState().isConnected).toBe(false)
  })

  it('setSidebarOpen で sidebarOpen が変わる', () => {
    act(() => { useStore.getState().setSidebarOpen(false) })
    expect(useStore.getState().sidebarOpen).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Template – applyTemplate / setSystemPrompt
// ─────────────────────────────────────────────

import { TEMPLATES } from '@/lib/templates'

describe('useStore – applyTemplate', () => {
  beforeEach(() => {
    resetStore()
    localStorage.clear()
  })

  it('applyTemplate で activeTemplateId が設定される', () => {
    act(() => { useStore.getState().applyTemplate('fishbone') })
    expect(useStore.getState().activeTemplateId).toBe('fishbone')
  })

  it('applyTemplate で systemPrompt がテンプレートの値に設定される', () => {
    const template = TEMPLATES.find((t) => t.id === 'fishbone')!
    act(() => { useStore.getState().applyTemplate('fishbone') })
    expect(useStore.getState().systemPrompt).toBe(template.systemPrompt)
  })

  it('applyTemplate で markdown がテンプレートの initialMarkdown に設定される', () => {
    const template = TEMPLATES.find((t) => t.id === 'fishbone')!
    act(() => { useStore.getState().applyTemplate('fishbone') })
    expect(useStore.getState().markdown).toBe(template.initialMarkdown)
  })

  it('applyTemplate で currentNote が生成される', () => {
    act(() => { useStore.getState().applyTemplate('swot') })
    expect(useStore.getState().currentNote).not.toBeNull()
  })

  it('applyTemplate で chatMessages がリセットされる', () => {
    act(() => {
      useStore.setState({ chatMessages: [{ id: '1', role: 'user', content: 'x', timestamp: '' }] })
      useStore.getState().applyTemplate('mindmap')
    })
    expect(useStore.getState().chatMessages).toHaveLength(0)
  })

  it('applyTemplate で pendingSuggestion がリセットされる', () => {
    act(() => {
      useStore.setState({
        pendingSuggestion: {
          suggestionId: 'sg1',
          summary: 'テスト',
          impacts: { nodesDelta: 0, edgesDelta: 0, changedNodeIds: [], changedEdgeIds: [] },
        },
      })
      useStore.getState().applyTemplate('flowchart')
    })
    expect(useStore.getState().pendingSuggestion).toBeNull()
  })

  it('applyTemplate でフロー Markdown がパースされノードが生成される', () => {
    act(() => { useStore.getState().applyTemplate('fishbone') })
    // fishbone has 7 nodes: 6 cause + 1 effect
    expect(useStore.getState().nodes.length).toBeGreaterThan(0)
  })

  it('存在しない id を applyTemplate しても状態が壊れない', () => {
    const before = useStore.getState().markdown
    act(() => { useStore.getState().applyTemplate('nonexistent-id') })
    // No crash, markdown unchanged
    expect(useStore.getState().markdown).toBe(before)
  })

  it('異なるテンプレートを連続適用すると最後のテンプレートで上書きされる', () => {
    act(() => { useStore.getState().applyTemplate('fishbone') })
    act(() => { useStore.getState().applyTemplate('swot') })
    expect(useStore.getState().activeTemplateId).toBe('swot')
    expect(useStore.getState().markdown).toContain('strength')
  })

  it('全10テンプレートを applyTemplate してもエラーにならない', () => {
    for (const t of TEMPLATES) {
      expect(() => {
        act(() => { useStore.getState().applyTemplate(t.id) })
      }).not.toThrow()
    }
  })
})

describe('useStore – setSystemPrompt', () => {
  beforeEach(resetStore)

  it('setSystemPrompt で systemPrompt が更新される', () => {
    act(() => { useStore.getState().setSystemPrompt('カスタムプロンプト') })
    expect(useStore.getState().systemPrompt).toBe('カスタムプロンプト')
  })

  it('setSystemPrompt で空文字を設定できる', () => {
    act(() => { useStore.getState().setSystemPrompt('何か') })
    act(() => { useStore.getState().setSystemPrompt('') })
    expect(useStore.getState().systemPrompt).toBe('')
  })

  it('applyTemplate 後に setSystemPrompt を呼ぶと上書きできる', () => {
    act(() => { useStore.getState().applyTemplate('fishbone') })
    act(() => { useStore.getState().setSystemPrompt('上書きプロンプト') })
    expect(useStore.getState().systemPrompt).toBe('上書きプロンプト')
  })
})
