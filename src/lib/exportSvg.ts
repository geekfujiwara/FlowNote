/**
 * SVG export utility for FlowNote canvas.
 *
 * Converts ReactFlow nodes + edges into a standalone SVG file that
 * visually matches the dark-theme canvas (zinc background, coloured
 * node shapes per nodeType, smoothstep bezier edges with labels).
 */

import type { Node, Edge } from '@xyflow/react'
import type { FlowNodeData, FlowNodeType } from '@/types'

// ─── Layout constants ────────────────────────────────────────────────────────

const PADDING = 80
const TITLE_HEIGHT = 36

// Fallback node dimensions (used when ReactFlow has not yet measured the node)
const NODE_DEFAULTS: Record<FlowNodeType, { width: number; height: number }> = {
  input:    { width: 160, height: 40 },
  output:   { width: 160, height: 40 },
  selector: { width: 80,  height: 80 },
  default:  { width: 160, height: 40 },
}

// ─── Color palette (matches CustomNode.tsx Tailwind colours) ─────────────────

const COLORS: Record<FlowNodeType, { fill: string; stroke: string; text: string }> = {
  input: {
    fill:   '#3730a3',  // indigo-800
    stroke: '#818cf8',  // indigo-400
    text:   '#e0e7ff',  // indigo-100
  },
  output: {
    fill:   '#064e3b',  // emerald-900
    stroke: '#34d399',  // emerald-400
    text:   '#d1fae5',  // emerald-100
  },
  selector: {
    fill:   '#78350f',  // amber-900
    stroke: '#fbbf24',  // amber-400
    text:   '#fef3c7',  // amber-100
  },
  default: {
    fill:   '#27272a',  // zinc-800
    stroke: '#71717a',  // zinc-500
    text:   '#f4f4f5',  // zinc-100
  },
}

const BG_COLOR        = '#09090b'  // zinc-950
const EDGE_COLOR      = '#71717a'  // zinc-500
const EDGE_LABEL_BG   = '#18181b'  // zinc-900
const EDGE_LABEL_TEXT = '#d4d4d8'  // zinc-300
const TITLE_COLOR     = '#a1a1aa'  // zinc-400

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getNodeType(node: Node<FlowNodeData>): FlowNodeType {
  return (node.data?.nodeType as FlowNodeType) ?? 'default'
}

function getNodeDimensions(node: Node<FlowNodeData>): { width: number; height: number } {
  const type = getNodeType(node)
  const defaults = NODE_DEFAULTS[type] ?? NODE_DEFAULTS.default
  return {
    width:  (node as Node<FlowNodeData> & { measured?: { width?: number } }).measured?.width  ?? defaults.width,
    height: (node as Node<FlowNodeData> & { measured?: { height?: number } }).measured?.height ?? defaults.height,
  }
}

/** Bottom-center handle position of a node (source side). */
function sourceHandle(node: Node<FlowNodeData>): { x: number; y: number } {
  const { width, height } = getNodeDimensions(node)
  return { x: node.position.x + width / 2, y: node.position.y + height }
}

/** Top-center handle position of a node (target side). */
function targetHandle(node: Node<FlowNodeData>): { x: number; y: number } {
  const { width } = getNodeDimensions(node)
  return { x: node.position.x + width / 2, y: node.position.y }
}

/** Cubic bezier path mimicking ReactFlow's smoothstep edges. */
function smoothstepPath(
  sx: number, sy: number,
  tx: number, ty: number,
): string {
  const dy = Math.abs(ty - sy)
  const offset = Math.max(dy * 0.5, 40)
  return `M ${sx} ${sy} C ${sx} ${sy + offset} ${tx} ${ty - offset} ${tx} ${ty}`
}

/** Midpoint of a cubic bezier at t=0.5 (de Casteljau). */
function bezierMid(
  sx: number, sy: number,
  tx: number, ty: number,
): { x: number; y: number } {
  const dy = Math.abs(ty - sy)
  const offset = Math.max(dy * 0.5, 40)
  const c1x = sx;  const c1y = sy + offset
  const c2x = tx;  const c2y = ty - offset
  // t=0.5
  const x = 0.125 * sx + 3 * 0.125 * c1x + 3 * 0.125 * c2x + 0.125 * tx
  const y = 0.125 * sy + 3 * 0.125 * c1y + 3 * 0.125 * c2y + 0.125 * ty
  return { x, y }
}

// ─── SVG element builders ─────────────────────────────────────────────────────

function buildNodeSvg(node: Node<FlowNodeData>): string {
  const type    = getNodeType(node)
  const colors  = COLORS[type]
  const { width, height } = getNodeDimensions(node)
  const x       = node.position.x
  const y       = node.position.y
  const label   = esc(node.data?.label ?? '')

  if (type === 'input' || type === 'output') {
    const rx = height / 2
    return [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}"`,
      `  rx="${rx}" ry="${rx}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`,
      `<text x="${x + width / 2}" y="${y + height / 2}"`,
      `  dominant-baseline="middle" text-anchor="middle"`,
      `  font-size="13" font-family="ui-sans-serif,system-ui,sans-serif"`,
      `  fill="${colors.text}" font-weight="500">${label}</text>`,
    ].join('\n')
  }

  if (type === 'selector') {
    const cx = x + width / 2
    const cy = y + height / 2
    const hw = width / 2
    const hh = height / 2
    const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`
    return [
      `<polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`,
      `<text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle"`,
      `  font-size="11" font-family="ui-sans-serif,system-ui,sans-serif"`,
      `  fill="${colors.text}" font-weight="500">${label}</text>`,
    ].join('\n')
  }

  // default (rounded rectangle)
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}"`,
    `  rx="12" ry="12" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"/>`,
    `<text x="${x + width / 2}" y="${y + height / 2}"`,
    `  dominant-baseline="middle" text-anchor="middle"`,
    `  font-size="13" font-family="ui-sans-serif,system-ui,sans-serif"`,
    `  fill="${colors.text}" font-weight="500">${label}</text>`,
  ].join('\n')
}

function buildEdgeSvg(
  edge: Edge,
  nodeMap: Map<string, Node<FlowNodeData>>,
  edgeIndex: number,
): string {
  const src = nodeMap.get(edge.source)
  const tgt = nodeMap.get(edge.target)
  if (!src || !tgt) return ''

  const sp = sourceHandle(src)
  const tp = targetHandle(tgt)
  const d  = smoothstepPath(sp.x, sp.y, tp.x, tp.y)
  const pathId = `en${edgeIndex}`
  const lines: string[] = []

  lines.push(
    `<path id="${pathId}" d="${d}" fill="none"`,
    `  stroke="${EDGE_COLOR}" stroke-width="1.5" marker-end="url(#arr)"/>`,
  )

  if (edge.label) {
    const mid = bezierMid(sp.x, sp.y, tp.x, tp.y)
    const labelText = esc(String(edge.label))
    const approxW = String(edge.label).length * 7 + 12
    const labelH = 18
    lines.push(
      `<rect x="${mid.x - approxW / 2}" y="${mid.y - labelH / 2}"`,
      `  width="${approxW}" height="${labelH}" rx="4" fill="${EDGE_LABEL_BG}"/>`,
      `<text x="${mid.x}" y="${mid.y}" dominant-baseline="middle" text-anchor="middle"`,
      `  font-size="11" font-family="ui-sans-serif,system-ui,sans-serif"`,
      `  fill="${EDGE_LABEL_TEXT}">${labelText}</text>`,
    )
  }

  return lines.join('\n')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a standalone SVG string from the given ReactFlow nodes and edges.
 *
 * @param nodes      Current nodes (from `getNodes()`)
 * @param edges      Current edges (from `getEdges()`)
 * @param noteTitle  Title rendered at the top of the SVG
 * @returns          SVG source string ready to save as a file
 */
export function exportFlowAsSvg(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  noteTitle: string,
): string {
  if (nodes.length === 0) {
    const w = 400; const h = 120
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `  <rect width="${w}" height="${h}" fill="${BG_COLOR}"/>`,
      `  <text x="${w / 2}" y="${h / 2}" dominant-baseline="middle" text-anchor="middle"`,
      `    font-size="14" font-family="ui-sans-serif,system-ui,sans-serif"`,
      `    fill="${EDGE_COLOR}">ノードがありません</text>`,
      `</svg>`,
    ].join('\n')
  }

  // ── Compute bounding box ─────────────────────────────────
  let minX = Infinity; let minY = Infinity
  let maxX = -Infinity; let maxY = -Infinity
  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node)
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }

  const svgWidth  = maxX - minX + PADDING * 2
  const svgHeight = maxY - minY + PADDING * 2 + TITLE_HEIGHT

  // ── Shift nodes into SVG coordinate space ────────────────
  const offsetX = PADDING - minX
  const offsetY = PADDING + TITLE_HEIGHT - minY
  const shiftedNodes = nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
  }))
  const nodeMap = new Map(shiftedNodes.map((n) => [n.id, n]))

  // ── Build SVG body ────────────────────────────────────────
  const edgesSvg = edges
    .map((e, i) => buildEdgeSvg(e, nodeMap, i))
    .filter(Boolean)
    .join('\n')

  const nodesSvg = shiftedNodes.map(buildNodeSvg).join('\n')

  const title    = esc(noteTitle)
  const titleX   = svgWidth / 2
  const titleY   = PADDING / 2 + TITLE_HEIGHT / 2

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     width="${svgWidth}" height="${svgHeight}"`,
    `     viewBox="0 0 ${svgWidth} ${svgHeight}">`,
    `  <defs>`,
    `    <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">`,
    `      <polygon points="0 0, 8 3, 0 6" fill="${EDGE_COLOR}"/>`,
    `    </marker>`,
    `  </defs>`,
    `  <!-- background -->`,
    `  <rect width="${svgWidth}" height="${svgHeight}" fill="${BG_COLOR}"/>`,
    `  <!-- title -->`,
    `  <text x="${titleX}" y="${titleY}" dominant-baseline="middle" text-anchor="middle"`,
    `    font-size="16" font-family="ui-sans-serif,system-ui,sans-serif"`,
    `    fill="${TITLE_COLOR}" font-weight="600">${title}</text>`,
    `  <!-- edges -->`,
    edgesSvg,
    `  <!-- nodes -->`,
    nodesSvg,
    `</svg>`,
  ].join('\n')
}

/**
 * Trigger a browser download of an SVG file.
 *
 * @param svgContent  SVG source string
 * @param filename    Desired filename (`.svg` appended if missing)
 */
export function downloadSvg(svgContent: string, filename: string): void {
  const name = filename.endsWith('.svg') ? filename : `${filename}.svg`
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
