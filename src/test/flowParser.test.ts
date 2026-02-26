import { describe, it, expect } from 'vitest'
import { parseFlowFromMarkdown, serializeFlowToBlock } from '@/lib/flowParser'

// ─────────────────────────────────────────────
// parseFlowFromMarkdown
// ─────────────────────────────────────────────

describe('parseFlowFromMarkdown', () => {
  it('空文字列の場合は空の nodes/edges を返す', () => {
    const result = parseFlowFromMarkdown('')
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })

  it('flow ブロックがない Markdown は空を返す', () => {
    const md = '# タイトル\n\nテキスト本文\n\n```js\nconsole.log(1)\n```'
    const result = parseFlowFromMarkdown(md)
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })

  // ─── Node type parsing ───────────────────

  it('[id] Label → default ノードとして解析される', () => {
    const md = '```flow\n[process] 処理\n```'
    const { nodes } = parseFlowFromMarkdown(md)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ id: 'process', label: '処理', type: 'default' })
  })

  it('[[id]] Label → input ノードとして解析される', () => {
    const md = '```flow\n[[start]] 開始\n```'
    const { nodes } = parseFlowFromMarkdown(md)
    expect(nodes[0]).toMatchObject({ id: 'start', label: '開始', type: 'input' })
  })

  it('((id)) Label → output ノードとして解析される', () => {
    const md = '```flow\n((end)) 終了\n```'
    const { nodes } = parseFlowFromMarkdown(md)
    expect(nodes[0]).toMatchObject({ id: 'end', label: '終了', type: 'output' })
  })

  it('{id} Label → selector ノードとして解析される', () => {
    const md = '```flow\n{decide} 判断\n```'
    const { nodes } = parseFlowFromMarkdown(md)
    expect(nodes[0]).toMatchObject({ id: 'decide', label: '判断', type: 'selector' })
  })

  // ─── Edge parsing ────────────────────────

  it('[A] -> [B] → エッジが生成される', () => {
    const md = '```flow\n[A] ノードA\n[B] ノードB\n\n[A] -> [B]\n```'
    const { edges } = parseFlowFromMarkdown(md)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ source: 'A', target: 'B' })
    expect(edges[0].label).toBeUndefined()
  })

  it('[A] -> [B] : ラベル → エッジラベルが解析される', () => {
    const md = '```flow\n[A] ノードA\n[B] ノードB\n\n[A] -> [B] : Yes\n```'
    const { edges } = parseFlowFromMarkdown(md)
    expect(edges[0].label).toBe('Yes')
  })

  it('エッジのみ記述時に暗黙ノードが生成される', () => {
    const md = '```flow\n[X] -> [Y]\n```'
    const { nodes, edges } = parseFlowFromMarkdown(md)
    expect(nodes.map((n) => n.id)).toContain('X')
    expect(nodes.map((n) => n.id)).toContain('Y')
    expect(edges).toHaveLength(1)
  })

  it('複数エッジが正しく解析される', () => {
    // エッジ記法は [id] -> [id] 形式（シングルブラケット）が仕様
    const md = '```flow\n[[s]] 開始\n[p1] 処理1\n[p2] 処理2\n((e)) 終了\n\n[s] -> [p1]\n[s] -> [p2]\n[p1] -> [e]\n[p2] -> [e]\n```'
    const { nodes, edges } = parseFlowFromMarkdown(md)
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(4)
  })

  it('同一ノードが重複定義されても1度しか追加されない', () => {
    const md = '```flow\n[a] ノードA\n[a] ノードA 重複\n```'
    const { nodes } = parseFlowFromMarkdown(md)
    expect(nodes.filter((n) => n.id === 'a')).toHaveLength(1)
  })

  it('複数の flow ブロックを結合して解析する', () => {
    const md = [
      '```flow\n[A] ノードA\n```',
      '```flow\n[B] ノードB\n[A] -> [B]\n```',
    ].join('\n\n')
    const { nodes, edges } = parseFlowFromMarkdown(md)
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(1)
  })

  it('空行・コメントなし行を正しく無視する', () => {
    const md = '```flow\n\n[[start]] 開始\n\n[step] ステップ\n\n((end)) 終了\n\n[start] -> [step]\n[step] -> [end]\n\n```'
    const { nodes, edges } = parseFlowFromMarkdown(md)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────
// serializeFlowToBlock
// ─────────────────────────────────────────────

describe('serializeFlowToBlock', () => {
  it('ParsedFlow を ```flow ブロック文字列に変換する', () => {
    const result = serializeFlowToBlock({
      nodes: [
        { id: 's', label: '開始', type: 'input' },
        { id: 'e', label: '終了', type: 'output' },
      ],
      edges: [{ id: 'e1', source: 's', target: 'e' }],
    })
    expect(result).toContain('```flow')
    expect(result).toContain('[[s]] 開始')
    expect(result).toContain('((e)) 終了')
    expect(result).toContain('[s] -> [e]')
    expect(result).toMatch(/```\s*$/)
  })

  it('エッジラベルがある場合 : 区切りで出力される', () => {
    const result = serializeFlowToBlock({
      nodes: [
        { id: 'a', label: 'A', type: 'default' },
        { id: 'b', label: 'B', type: 'default' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', label: 'Yes' }],
    })
    expect(result).toContain('[a] -> [b] : Yes')
  })

  it('selector ノードは {id} 書式で出力される', () => {
    const result = serializeFlowToBlock({
      nodes: [{ id: 'dec', label: '判断', type: 'selector' }],
      edges: [],
    })
    expect(result).toContain('{dec} 判断')
  })

  it('parse → serialize → parse でラウンドトリップが成立する', () => {
    const original = '```flow\n[[start]] 開始\n[proc] 処理\n((end)) 終了\n\n[[start]] -> [proc]\n[proc] -> ((end))\n```'
    const md = `# テスト\n\n${original}`
    const parsed = parseFlowFromMarkdown(md)
    const serialized = serializeFlowToBlock(parsed)
    const reparsed = parseFlowFromMarkdown(serialized)

    expect(reparsed.nodes.map((n) => n.id).sort())
      .toEqual(parsed.nodes.map((n) => n.id).sort())
    expect(reparsed.edges).toHaveLength(parsed.edges.length)
  })
})
