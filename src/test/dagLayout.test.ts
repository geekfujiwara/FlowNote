import { describe, it, expect } from 'vitest'
import { applyDagreLayout } from '@/lib/dagLayout'
import type { ParsedFlow } from '@/types'

const SAMPLE_FLOW: ParsedFlow = {
  nodes: [
    { id: 'start', label: '開始', type: 'input' },
    { id: 'proc',  label: '処理', type: 'default' },
    { id: 'end',   label: '終了', type: 'output' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'proc' },
    { id: 'e2', source: 'proc',  target: 'end' },
  ],
}

describe('applyDagreLayout', () => {
  it('すべてのノードを xNode に変換する', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW)
    expect(nodes).toHaveLength(3)
  })

  it('すべてのエッジを xEdge に変換する', () => {
    const { edges } = applyDagreLayout(SAMPLE_FLOW)
    expect(edges).toHaveLength(2)
  })

  it('各ノードの position が数値である', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW)
    for (const n of nodes) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
      expect(isNaN(n.position.x)).toBe(false)
      expect(isNaN(n.position.y)).toBe(false)
    }
  })

  it('ノードの type が "flowNode" に設定される', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW)
    for (const n of nodes) {
      expect(n.type).toBe('flowNode')
    }
  })

  it('ノードの data に label と nodeType が含まれる', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW)
    const startNode = nodes.find((n) => n.id === 'start')!
    expect(startNode.data.label).toBe('開始')
    expect(startNode.data.nodeType).toBe('input')
  })

  it('エッジの source / target が正しくコピーされる', () => {
    const { edges } = applyDagreLayout(SAMPLE_FLOW)
    expect(edges[0]).toMatchObject({ source: 'start', target: 'proc' })
    expect(edges[1]).toMatchObject({ source: 'proc',  target: 'end' })
  })

  it('エッジの type が smoothstep に設定される', () => {
    const { edges } = applyDagreLayout(SAMPLE_FLOW)
    for (const e of edges) {
      expect(e.type).toBe('smoothstep')
    }
  })

  it('TB (デフォルト) レイアウトで start の y < proc の y', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW)
    const startY = nodes.find((n) => n.id === 'start')!.position.y
    const procY  = nodes.find((n) => n.id === 'proc')!.position.y
    const endY   = nodes.find((n) => n.id === 'end')!.position.y
    // Top-to-bottom: start comes before proc and proc before end
    expect(startY).toBeLessThan(procY)
    expect(procY).toBeLessThan(endY)
  })

  it('LR レイアウトで start の x < proc の x', () => {
    const { nodes } = applyDagreLayout(SAMPLE_FLOW, 'LR')
    const startX = nodes.find((n) => n.id === 'start')!.position.x
    const procX  = nodes.find((n) => n.id === 'proc')!.position.x
    expect(startX).toBeLessThan(procX)
  })

  it('ノードが空のときに空配列を返す', () => {
    const { nodes, edges } = applyDagreLayout({ nodes: [], edges: [] })
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it('接続されていないノードも位置を持つ', () => {
    const flow: ParsedFlow = {
      nodes: [
        { id: 'a', label: 'A', type: 'default' },
        { id: 'b', label: 'B', type: 'default' },
      ],
      edges: [], // no edges
    }
    const { nodes } = applyDagreLayout(flow)
    for (const n of nodes) {
      expect(isNaN(n.position.x)).toBe(false)
      expect(isNaN(n.position.y)).toBe(false)
    }
  })

  it('エッジのソース/ターゲットが存在しないノードは無視される', () => {
    const flow: ParsedFlow = {
      nodes: [{ id: 'a', label: 'A', type: 'default' }],
      edges: [{ id: 'e1', source: 'a', target: 'MISSING' }],
    }
    expect(() => applyDagreLayout(flow)).not.toThrow()
  })
})
