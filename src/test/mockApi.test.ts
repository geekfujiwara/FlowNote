import { describe, it, expect, beforeEach } from 'vitest'
import { listNotes, loadNote, saveNote, deleteNote, agentChat } from '@/lib/mockApi'

// ─────────────────────────────────────────────
// localStorage モック API
// ─────────────────────────────────────────────

describe('mockApi – listNotes', () => {
  it('初期状態は空配列を返す', async () => {
    const notes = await listNotes()
    expect(notes).toEqual([])
  })

  it('保存後にノートが一覧に現れる', async () => {
    await saveNote({ id: 'note-1', title: 'テスト', markdown: '# テスト' })
    const notes = await listNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe('note-1')
    expect(notes[0].title).toBe('テスト')
  })

  it('新しい順(updatedAt降順)に並ぶ', async () => {
    await saveNote({ id: 'old', title: '古い', markdown: '# 古い' })
    await new Promise((r) => setTimeout(r, 10))
    await saveNote({ id: 'new', title: '新しい', markdown: '# 新しい' })
    const notes = await listNotes()
    expect(notes[0].id).toBe('new')
    expect(notes[1].id).toBe('old')
  })
})

describe('mockApi – saveNote / loadNote', () => {
  it('保存したノートを id で取得できる', async () => {
    await saveNote({ id: 'n1', title: 'ノート1', markdown: '# ノート1\n内容' })
    const detail = await loadNote('n1')
    expect(detail.title).toBe('ノート1')
    expect(detail.markdown).toBe('# ノート1\n内容')
  })

  it('上書き保存で内容が更新される', async () => {
    await saveNote({ id: 'n1', title: '古い', markdown: '古い内容' })
    await saveNote({ id: 'n1', title: '新しい', markdown: '新しい内容' })
    const detail = await loadNote('n1')
    expect(detail.title).toBe('新しい')
    expect(detail.markdown).toBe('新しい内容')
  })

  it('tags が保存・復元される', async () => {
    await saveNote({ id: 'n2', title: 'T', markdown: '', tags: ['foo', 'bar'] })
    const detail = await loadNote('n2')
    expect(detail.tags).toEqual(['foo', 'bar'])
  })

  it('存在しない id で loadNote するとエラーになる', async () => {
    await expect(loadNote('does-not-exist')).rejects.toThrow()
  })

  it('updatedAt が ISO 文字列として返る', async () => {
    await saveNote({ id: 'n3', title: 'T', markdown: '' })
    const detail = await loadNote('n3')
    expect(() => new Date(detail.updatedAt)).not.toThrow()
    expect(new Date(detail.updatedAt).getFullYear()).toBeGreaterThan(2020)
  })
})

describe('mockApi – deleteNote', () => {
  it('削除後は一覧から消える', async () => {
    await saveNote({ id: 'del-1', title: '削除対象', markdown: '' })
    await deleteNote('del-1')
    const notes = await listNotes()
    expect(notes.find((n) => n.id === 'del-1')).toBeUndefined()
  })

  it('存在しない id を削除してもエラーにならない', async () => {
    await expect(deleteNote('not-exist')).resolves.not.toThrow()
  })

  it('削除後に loadNote するとエラーになる', async () => {
    await saveNote({ id: 'del-2', title: 'T', markdown: '' })
    await deleteNote('del-2')
    await expect(loadNote('del-2')).rejects.toThrow()
  })
})

describe('mockApi – agentChat (mock)', () => {
  const basePayload = {
    noteId: 'note-1',
    message: '',
    context: {
      markdown: '# テスト\n```flow\n[[start]] 開始\n```',
      selection: { nodeIds: [], edgeIds: [] },
      metadata: null,
    },
  }

  it('suggestionId を返す', async () => {
    const result = await agentChat({ ...basePayload, message: 'テスト' })
    expect(result.suggestionId).toBeTruthy()
  })

  it('summary が文字列として返る', async () => {
    const result = await agentChat({ ...basePayload, message: 'テスト' })
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
  })

  it('impacts に nodesDelta / edgesDelta が含まれる', async () => {
    const result = await agentChat({ ...basePayload, message: 'テスト' })
    expect(typeof result.impacts.nodesDelta).toBe('number')
    expect(typeof result.impacts.edgesDelta).toBe('number')
  })

  it('"追加" メッセージで nodesDelta > 0 になる', async () => {
    const result = await agentChat({ ...basePayload, message: 'レビューノードを追加して' })
    expect(result.impacts.nodesDelta).toBeGreaterThan(0)
  })

  it('"シンプル" メッセージで markdown が返る', async () => {
    const result = await agentChat({ ...basePayload, message: 'シンプルにして' })
    expect(result.markdown).toBeTruthy()
    expect(result.markdown).toContain('```flow')
  })

  it('"並行" メッセージで並行処理フローが返る', async () => {
    const result = await agentChat({ ...basePayload, message: '並行処理フローに変更して' })
    expect(result.markdown).toContain('processA')
    expect(result.markdown).toContain('processB')
  })
})
