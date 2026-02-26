import React, { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import {
  X,
  BarChart2,
  FileText,
  Layers,
  GitBranch,
  Bot,
  Clock,
  GitCommit,
  MessageSquare,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface KpiCard {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  color: string
}

// ─────────────────────────────────────────────────────────────
// Micro chart helpers
// ─────────────────────────────────────────────────────────────

function HBar({ value, max, color = '#6366f1' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] text-zinc-400 w-6 text-right">{value}</span>
    </div>
  )
}

function Sparkline({ values, color = '#6366f1' }: { values: number[]; color?: string }) {
  if (values.length < 2) {
    return <div className="h-10 flex items-center justify-center text-[10px] text-zinc-600">データなし</div>
  }
  const w = 160
  const h = 40
  const max = Math.max(...values, 1)
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`)
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* last value dot */}
      {(() => {
        const last = values.length - 1
        const x = last * step
        const y = h - (values[last] / max) * (h - 4)
        return <circle cx={x} cy={y} r="2.5" fill={color} />
      })()}
    </svg>
  )
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-zinc-600">データなし</div>
    )
  }
  const r = 36
  const cx = 44
  const cy = 44
  let angle = -90
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * 360
    const rad = (a: number) => (a * Math.PI) / 180
    const x1 = cx + r * Math.cos(rad(angle))
    const y1 = cy + r * Math.sin(rad(angle))
    angle += sweep
    const x2 = cx + r * Math.cos(rad(angle))
    const y2 = cy + r * Math.sin(rad(angle))
    const large = sweep > 180 ? 1 : 0
    return { ...s, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` }
  })
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="w-20 h-20 shrink-0">
        {arcs.map((a) => (
          <path key={a.label} d={a.path} fill={a.color} />
        ))}
        <circle cx={cx} cy={cy} r={20} fill="#18181b" />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#a1a1aa" fontSize="9">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="ml-auto text-zinc-300 font-medium pl-3">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function AnalyticsPanel({ onClose }: Props) {
  const notes        = useStore((s) => s.notes)
  const nodes        = useStore((s) => s.nodes)
  const edges        = useStore((s) => s.edges)
  const chatMessages = useStore((s) => s.chatMessages)
  const versionHistory = useStore((s) => s.versionHistory)
  const currentNote  = useStore((s) => s.currentNote)

  // ── KPI derivations ─────────────────────────────────────────
  const userMsgs   = chatMessages.filter((m) => m.role === 'user').length
  const agentMsgs  = chatMessages.filter((m) => m.role === 'agent').length
  const aiVersions = versionHistory.filter((v) => v.label.startsWith('AI:')).length
  const manualVersions = versionHistory.length - aiVersions

  // ── Version history sparkline (cumulative per hour bucket) ──
  const versionSparkline = useMemo(() => {
    if (versionHistory.length === 0) return []
    const sorted = [...versionHistory].reverse() // oldest first
    const buckets: number[] = []
    let cum = 0
    sorted.forEach((v, i) => {
      cum++
      if ((i + 1) % Math.max(1, Math.ceil(sorted.length / 20)) === 0 || i === sorted.length - 1) {
        buckets.push(cum)
      }
    })
    return buckets
  }, [versionHistory])

  // ── Node type breakdown ──────────────────────────────────────
  const nodeCounts = useMemo(() => {
    const counts = { default: 0, input: 0, output: 0, selector: 0 }
    nodes.forEach((n) => {
      const t = (n.data?.nodeType as keyof typeof counts) ?? 'default'
      counts[t] = (counts[t] ?? 0) + 1
    })
    return counts
  }, [nodes])

  // ── KPI cards ────────────────────────────────────────────────
  const kpis: KpiCard[] = [
    {
      label: 'ノート数',
      value: notes.length,
      sub: '保存済み',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-indigo-400',
    },
    {
      label: 'ノード',
      value: nodes.length,
      sub: `エッジ: ${edges.length}`,
      icon: <Layers className="w-4 h-4" />,
      color: 'text-sky-400',
    },
    {
      label: 'バージョン',
      value: versionHistory.length,
      sub: `AI変更: ${aiVersions}件`,
      icon: <GitCommit className="w-4 h-4" />,
      color: 'text-amber-400',
    },
    {
      label: 'チャット',
      value: userMsgs,
      sub: `AI応答: ${agentMsgs}件`,
      icon: <MessageSquare className="w-4 h-4" />,
      color: 'text-purple-400',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm">
      <div className="ml-auto w-full max-w-3xl bg-zinc-950 border-l border-zinc-800 flex flex-col h-full overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900">
          <BarChart2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">利用状況アナリティクス</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {currentNote ? `現在: ${currentNote.title}` : 'ノート未選択'}
              {' · '}アプリ起動からのデータ
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col gap-2"
              >
                <div className={`flex items-center gap-2 ${k.color}`}>
                  {k.icon}
                  <span className="text-xs font-medium text-zinc-400">{k.label}</span>
                </div>
                <span className="text-2xl font-bold text-zinc-100">{k.value}</span>
                {k.sub && <span className="text-[11px] text-zinc-500">{k.sub}</span>}
              </div>
            ))}
          </div>

          {/* Row: Version history + Node breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Version history chart */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-zinc-300">バージョン履歴の推移</span>
                <span className="ml-auto text-[11px] text-zinc-500">{versionHistory.length} 件</span>
              </div>
              <Sparkline values={versionSparkline.length ? versionSparkline : [0, 0]} color="#f59e0b" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-zinc-500">AI自動保存</div>
                  <div className="text-amber-300 font-semibold mt-0.5">{aiVersions}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-zinc-500">手動スナップ</div>
                  <div className="text-amber-300 font-semibold mt-0.5">{manualVersions}</div>
                </div>
              </div>
            </div>

            {/* Node type donut */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-medium text-zinc-300">ノード種別の内訳</span>
                <span className="ml-auto text-[11px] text-zinc-500">{nodes.length} ノード</span>
              </div>
              <DonutChart
                slices={[
                  { label: '通常', value: nodeCounts.default, color: '#6366f1' },
                  { label: '入力', value: nodeCounts.input,   color: '#22d3ee' },
                  { label: '出力', value: nodeCounts.output,  color: '#34d399' },
                  { label: '条件', value: nodeCounts.selector, color: '#f59e0b' },
                ].filter((s) => s.value > 0)}
              />
            </div>
          </div>

          {/* Top notes by node count */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-zinc-300">ノート一覧 (ノード数・更新順)</span>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">ノートがありません</p>
            ) : (
              <div className="space-y-3">
                {[...notes]
                  .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
                  .slice(0, 8)
                  .map((n, i) => {
                    // We don't have per-note node count in the list; use index as proxy bar
                    const barMax = notes.length
                    return (
                      <div key={n.id} className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-500 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-300 truncate mb-1">{n.title}</div>
                          <HBar
                            value={barMax - i}
                            max={barMax}
                            color={n.id === currentNote?.id ? '#6366f1' : '#3f3f46'}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-500 shrink-0">
                          {new Date(n.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </span>
                        {n.tags && n.tags.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {n.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* AI Usage stats */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-zinc-300">AI エージェント 利用状況</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'ユーザー送信', value: userMsgs, color: '#a78bfa' },
                { label: 'AI応答', value: agentMsgs, color: '#818cf8' },
                { label: 'AI変更適用', value: aiVersions, color: '#34d399' },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-800/60 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {userMsgs > 0 && (
              <div className="mt-3">
                <div className="text-[11px] text-zinc-500 mb-1">
                  AI応答率 ({agentMsgs}/{userMsgs})
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700"
                    style={{ width: `${Math.min(100, (agentMsgs / userMsgs) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* App Insights badge */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">
            <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              テレメトリは <strong className="text-zinc-300">Azure Application Insights</strong> に送信されています。
              詳細なログ・クエリは Azure Portal の Application Insights ブレードで確認できます。
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
