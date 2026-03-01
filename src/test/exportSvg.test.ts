import { describe, it, expect } from 'vitest'
import { exportFlowAsSvg } from '@/lib/exportSvg'
import type { Node, Edge } from '@xyflow/react'
import type { FlowNodeData } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  label: string,
  nodeType: FlowNodeData['nodeType'],
  x = 0,
  y = 0,
): Node<FlowNodeData> {
  return {
    id,
    type: 'flowNode',
    position: { x, y },
    data: { label, nodeType, isChanged: false, changeSource: 'user' },
    measured: { width: nodeType === 'selector' ? 80 : 160, height: nodeType === 'selector' ? 80 : 40 },
  } as Node<FlowNodeData>
}

function makeEdge(id: string, source: string, target: string, label?: string): Edge {
  return { id, source, target, label, type: 'smoothstep' }
}

const NODES: Node<FlowNodeData>[] = [
  makeNode('n1', '開始',   'input',    100, 0),
  makeNode('n2', '処理A',  'default',  100, 120),
  makeNode('n3', '分岐',   'selector', 100, 240),
  makeNode('n4', '終了',   'output',   100, 360),
]

const EDGES: Edge[] = [
  makeEdge('e1', 'n1', 'n2'),
  makeEdge('e2', 'n2', 'n3', '条件'),
  makeEdge('e3', 'n3', 'n4'),
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportFlowAsSvg', () => {
  it('有効なSVGを返す（xml宣言 + svg要素）', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'テストフロー')
    expect(svg).toContain('<?xml version="1.0"')
    expect(svg).toContain('<svg ')
    expect(svg).toContain('</svg>')
  })

  it('ノートタイトルがSVGに含まれる', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'マイフロー')
    expect(svg).toContain('マイフロー')
  })

  it('全ノードラベルがSVGに含まれる', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'T')
    expect(svg).toContain('開始')
    expect(svg).toContain('処理A')
    expect(svg).toContain('分岐')
    expect(svg).toContain('終了')
  })

  it('エッジラベルがSVGに含まれる', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'T')
    expect(svg).toContain('条件')
  })

  it('inputノードはpill形状（rx=20 相当）で描画される', () => {
    const svg = exportFlowAsSvg([makeNode('a', 'Start', 'input', 0, 0)], [], 'T')
    // rx = height/2 = 40/2 = 20
    expect(svg).toContain('rx="20"')
    expect(svg).toContain('#3730a3')   // indigo fill
  })

  it('outputノードはemerald配色で描画される', () => {
    const svg = exportFlowAsSvg([makeNode('a', 'End', 'output', 0, 0)], [], 'T')
    expect(svg).toContain('#064e3b')   // emerald fill
  })

  it('selectorノードはpolygon（ダイアモンド）で描画される', () => {
    const svg = exportFlowAsSvg([makeNode('a', 'If', 'selector', 0, 0)], [], 'T')
    expect(svg).toContain('<polygon ')
    expect(svg).toContain('#78350f')   // amber fill
  })

  it('defaultノードはrounded-rect（rx=12）で描画される', () => {
    const svg = exportFlowAsSvg([makeNode('a', 'Proc', 'default', 0, 0)], [], 'T')
    expect(svg).toContain('rx="12"')
    expect(svg).toContain('#27272a')   // zinc fill
  })

  it('エッジはpath要素として描画される', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'T')
    const pathCount = (svg.match(/<path /g) ?? []).length
    expect(pathCount).toBeGreaterThanOrEqual(3)  // edges (at minimum 3)
  })

  it('矢印マーカーが定義される', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'T')
    expect(svg).toContain('<marker ')
    expect(svg).toContain('marker-end="url(#arr)"')
  })

  it('width / height 属性が正の数値である', () => {
    const svg = exportFlowAsSvg(NODES, EDGES, 'T')
    const wMatch = svg.match(/width="(\d+)"/)
    const hMatch = svg.match(/height="(\d+)"/)
    expect(wMatch).not.toBeNull()
    expect(hMatch).not.toBeNull()
    expect(Number(wMatch![1])).toBeGreaterThan(0)
    expect(Number(hMatch![1])).toBeGreaterThan(0)
  })

  it('ノードが0件のとき空SVGを返す', () => {
    const svg = exportFlowAsSvg([], [], 'Empty')
    expect(svg).toContain('<svg ')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('ノードがありません')
  })

  it('XMLの特殊文字をエスケープする', () => {
    const node = makeNode('x', '<スクリプト & "テスト">', 'default', 0, 0)
    const svg = exportFlowAsSvg([node], [], 'T')
    expect(svg).not.toContain('<スクリプト')
    expect(svg).toContain('&lt;')
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&quot;')
  })

  it('measuredが未設定のノードもデフォルト寸法でレンダリングされる', () => {
    const node: Node<FlowNodeData> = {
      id: 'u',
      type: 'flowNode',
      position: { x: 50, y: 50 },
      data: { label: 'Unmeasured', nodeType: 'default', isChanged: false, changeSource: 'user' },
    } as Node<FlowNodeData>
    const svg = exportFlowAsSvg([node], [], 'T')
    expect(svg).toContain('Unmeasured')
  })

  it('孤立エッジ（存在しないsource/target）は無視される', () => {
    const orphan = makeEdge('ghost', 'nonexistent', 'n1')
    const svg = exportFlowAsSvg(NODES, [orphan], 'T')
    // 存在しないソースを参照するpath要素は含まれない（エラーにならない）
    expect(svg).toContain('<svg ')
  })
})
