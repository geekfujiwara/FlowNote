import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { useStore } from '@/store/useStore'

// ─────────────────────────────────────────────
// Helper to pre-populate store notes
// ─────────────────────────────────────────────

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
    canvasMode: 'select',
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isSaving: false,
    isConnected: false,
    sidebarOpen: true,
    lastAppliedChange: null,
    animateOnUpdate: true,
  })
  localStorage.clear()
}

// ─────────────────────────────────────────────
// Sidebar tests
// ─────────────────────────────────────────────

import { Sidebar } from '@/components/sidebar/Sidebar'

describe('Sidebar', () => {
  beforeEach(resetStore)

  it('ノートが0件のとき「ノートがありません」が表示される', () => {
    render(<Sidebar />)
    expect(screen.getByText('ノートがありません')).toBeInTheDocument()
  })

  it('ノートが存在するとき一覧に表示される', () => {
    act(() => {
      useStore.setState({
        notes: [
          { id: '1', title: 'フロー1', updatedAt: new Date().toISOString() },
          { id: '2', title: 'フロー2', updatedAt: new Date().toISOString() },
        ],
      })
    })
    render(<Sidebar />)
    expect(screen.getByText('フロー1')).toBeInTheDocument()
    expect(screen.getByText('フロー2')).toBeInTheDocument()
  })

  it('検索でノートをフィルタできる', async () => {
    act(() => {
      useStore.setState({
        notes: [
          { id: '1', title: '承認フロー', updatedAt: new Date().toISOString() },
          { id: '2', title: '登録フロー', updatedAt: new Date().toISOString() },
        ],
      })
    })
    render(<Sidebar />)
    const searchInput = screen.getByPlaceholderText('検索...')
    await userEvent.type(searchInput, '承認')
    expect(screen.getByText('承認フロー')).toBeInTheDocument()
    expect(screen.queryByText('登録フロー')).not.toBeInTheDocument()
  })

  it('新規ボタンをクリックすると newNote が呼ばれる', async () => {
    const spy = vi.spyOn(useStore.getState(), 'newNote')
    render(<Sidebar />)
    await userEvent.click(screen.getByTitle('新しいノートを作成'))
    expect(spy).toHaveBeenCalledOnce()
  })

  it('ノート件数バッジが正しく表示される', () => {
    act(() => {
      useStore.setState({
        notes: [
          { id: '1', title: 'A', updatedAt: new Date().toISOString() },
          { id: '2', title: 'B', updatedAt: new Date().toISOString() },
          { id: '3', title: 'C', updatedAt: new Date().toISOString() },
        ],
      })
    })
    render(<Sidebar />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('アクティブなノートがハイライトされる', () => {
    act(() => {
      useStore.setState({
        notes: [{ id: 'active-id', title: 'アクティブノート', updatedAt: new Date().toISOString() }],
        currentNote: { id: 'active-id', title: 'アクティブノート', updatedAt: new Date().toISOString() },
      })
    })
    render(<Sidebar />)
    const item = screen.getByText('アクティブノート').closest('[class*="indigo"]')
    expect(item).toBeTruthy()
  })
})

// ─────────────────────────────────────────────
// MarkdownEditor tests
// ─────────────────────────────────────────────

import { MarkdownEditor } from '@/components/editor/MarkdownEditor'

describe('MarkdownEditor', () => {
  beforeEach(resetStore)

  it('currentNote がないとき「ノートを選択してください」が表示される', () => {
    render(<MarkdownEditor />)
    expect(screen.getByText('ノートを選択してください')).toBeInTheDocument()
  })

  it('currentNote があるとき CodeMirror が表示される', () => {
    act(() => {
      useStore.setState({
        currentNote: { id: '1', title: 'T', updatedAt: '' },
        markdown: '# Hello',
      })
    })
    render(<MarkdownEditor />)
    expect(screen.getByTestId('codemirror')).toBeInTheDocument()
  })

  it('エディタの値が markdown ストアの値と一致する', () => {
    act(() => {
      useStore.setState({
        currentNote: { id: '1', title: 'T', updatedAt: '' },
        markdown: '# マークダウンテスト',
      })
    })
    render(<MarkdownEditor />)
    const editor = screen.getByTestId('codemirror') as HTMLTextAreaElement
    expect(editor.value).toBe('# マークダウンテスト')
  })

  it('入力変更が setMarkdown を呼び出す', async () => {
    act(() => {
      useStore.setState({
        currentNote: { id: '1', title: 'T', updatedAt: '' },
        markdown: '# 初期値',
      })
    })
    render(<MarkdownEditor />)
    const editor = screen.getByTestId('codemirror')
    await userEvent.clear(editor)
    await userEvent.type(editor, '# 新しい値')
    expect(useStore.getState().markdown).toContain('新しい値')
  })
})

// ─────────────────────────────────────────────
// SuggestionCard tests
// ─────────────────────────────────────────────

import { SuggestionCard } from '@/components/chat/SuggestionCard'
import type { Suggestion } from '@/types'

const MOCK_SUGGESTION: Suggestion = {
  suggestionId: 'sg-test',
  markdown: '# Updated\n```flow\n[[s]] 開始\n((e)) 終了\n\n[[s]] -> ((e))\n```',
  summary: 'テスト提案の概要です',
  impacts: {
    nodesDelta: 1,
    edgesDelta: -1,
    changedNodeIds: ['new-node'],
    changedEdgeIds: [],
  },
}

describe('SuggestionCard', () => {
  beforeEach(resetStore)

  it('summary が表示される', () => {
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    expect(screen.getByText('テスト提案の概要です')).toBeInTheDocument()
  })

  it('"AI 提案" ヘッダーが表示される', () => {
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    expect(screen.getByText('AI 提案')).toBeInTheDocument()
  })

  it('nodesDelta のプラス値が表示される (+1)', () => {
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('edgesDelta のマイナス値が表示される (-1)', () => {
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('「適用」ボタンクリックで applySuggestion が呼ばれる', async () => {
    act(() => {
      useStore.setState({ pendingSuggestion: MOCK_SUGGESTION })
    })
    const applySpy = vi.spyOn(useStore.getState(), 'applySuggestion')
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    await userEvent.click(screen.getByText('適用'))
    expect(applySpy).toHaveBeenCalledOnce()
  })

  it('「✕」ボタンクリックで discardSuggestion が呼ばれる', async () => {
    const discardSpy = vi.spyOn(useStore.getState(), 'discardSuggestion')
    render(<SuggestionCard suggestion={MOCK_SUGGESTION} />)
    await userEvent.click(screen.getByTitle('破棄'))
    expect(discardSpy).toHaveBeenCalledOnce()
  })
})

// ─────────────────────────────────────────────
// FlowMetadataPanel tests
// ─────────────────────────────────────────────

import { FlowMetadataPanel } from '@/components/shared/FlowMetadataPanel'

describe('FlowMetadataPanel', () => {
  beforeEach(resetStore)

  it('currentNote がないとき何も表示されない', () => {
    const { container } = render(<FlowMetadataPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('ノートタイトルが表示される', () => {
    act(() => {
      useStore.setState({
        currentNote: { id: '1', title: 'メタデータテスト', updatedAt: new Date().toISOString() },
        nodes: [],
        edges: [],
      })
    })
    render(<FlowMetadataPanel />)
    expect(screen.getByText('メタデータテスト')).toBeInTheDocument()
  })

  it('ノード数・エッジ数が表示される', () => {
    act(() => {
      useStore.setState({
        currentNote: { id: '1', title: 'T', updatedAt: new Date().toISOString() },
        nodes: [
          { id: 'a', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'A', nodeType: 'default' } },
          { id: 'b', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'B', nodeType: 'default' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
        ],
      })
    })
    render(<FlowMetadataPanel />)
    expect(screen.getByText('2 ノード')).toBeInTheDocument()
    expect(screen.getByText('1 エッジ')).toBeInTheDocument()
  })

  it('tags が表示される', () => {
    act(() => {
      useStore.setState({
        currentNote: {
          id: '1', title: 'T', updatedAt: new Date().toISOString(), tags: ['tag1', 'tag2'],
        },
        nodes: [],
        edges: [],
      })
    })
    render(<FlowMetadataPanel />)
    expect(screen.getByText('tag1')).toBeInTheDocument()
    expect(screen.getByText('tag2')).toBeInTheDocument()
  })
})
