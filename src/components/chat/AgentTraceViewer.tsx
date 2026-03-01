import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  Minus,
  GitBranch,
  Shuffle,
  WrapText,
  Terminal,
} from 'lucide-react'
import type { AgentTraceEntry } from '@/types'

// ─────────────────────────────────────────────
// Tool metadata
// ─────────────────────────────────────────────

interface ToolConfig {
  badgeClass: string
  dotClass: string
  icon: React.ReactNode
}

const TOOL_CONFIG: Record<string, ToolConfig> = {
  add_node: {
    badgeClass: 'bg-emerald-900/60 text-emerald-300 border border-emerald-800',
    dotClass: 'bg-emerald-500',
    icon: <Plus className="w-2.5 h-2.5" />,
  },
  remove_node: {
    badgeClass: 'bg-red-900/60 text-red-300 border border-red-800',
    dotClass: 'bg-red-500',
    icon: <Minus className="w-2.5 h-2.5" />,
  },
  add_edge: {
    badgeClass: 'bg-blue-900/60 text-blue-300 border border-blue-800',
    dotClass: 'bg-blue-500',
    icon: <GitBranch className="w-2.5 h-2.5" />,
  },
  remove_edge: {
    badgeClass: 'bg-orange-900/60 text-orange-300 border border-orange-800',
    dotClass: 'bg-orange-500',
    icon: <Minus className="w-2.5 h-2.5" />,
  },
  replace_flow: {
    badgeClass: 'bg-purple-900/60 text-purple-300 border border-purple-800',
    dotClass: 'bg-purple-500',
    icon: <Shuffle className="w-2.5 h-2.5" />,
  },
}

const DEFAULT_TOOL: ToolConfig = {
  badgeClass: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  dotClass: 'bg-zinc-500',
  icon: <WrapText className="w-2.5 h-2.5" />,
}

// ─────────────────────────────────────────────
// Args formatter
// ─────────────────────────────────────────────

function ArgsTable({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  if (entries.length === 0) return null
  return (
    <table className="w-full text-[10px] mt-1">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-t border-zinc-700/50">
            <td className="py-0.5 pr-2 text-zinc-500 whitespace-nowrap align-top">{k}</td>
            <td className="py-0.5 text-zinc-300 break-all">
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─────────────────────────────────────────────
// Single trace entry row
// ─────────────────────────────────────────────

function TraceEntryRow({ entry }: { entry: AgentTraceEntry }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TOOL_CONFIG[entry.tool] ?? DEFAULT_TOOL

  return (
    <div className="group">
      {/* Row header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800/60 rounded transition-colors text-left"
      >
        {/* Seq + dot */}
        <span className="text-[10px] text-zinc-600 w-3 text-right shrink-0">
          {entry.seq}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />

        {/* Tool badge */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0 ${cfg.badgeClass}`}
        >
          {cfg.icon}
          {entry.tool}
        </span>

        {/* Quick args preview */}
        <span className="flex-1 text-[10px] text-zinc-500 truncate">
          {formatArgsSummary(entry.args)}
        </span>

        {/* Duration */}
        <span className="text-[10px] text-zinc-600 shrink-0 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {entry.durationMs}ms
        </span>

        {/* Expand toggle */}
        <span className="text-zinc-600 shrink-0">
          {expanded
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mx-2 mb-2 px-2.5 py-2 bg-zinc-800/40 rounded border border-zinc-700/50">
          {/* Args */}
          {Object.keys(entry.args).length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">引数</p>
              <ArgsTable args={entry.args} />
            </div>
          )}
          {/* Result */}
          <div className={Object.keys(entry.args).length > 0 ? 'mt-2' : ''}>
            <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">結果</p>
            <p className="text-[10px] text-zinc-300 font-mono leading-relaxed">{entry.result}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatArgsSummary(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 20 ? v.slice(0, 20) + '…' : JSON.stringify(v)}`)
  return parts.join(', ')
}

// ─────────────────────────────────────────────
// Main viewer
// ─────────────────────────────────────────────

interface AgentTraceViewerProps {
  trace: AgentTraceEntry[]
  executionMs?: number
}

export function AgentTraceViewer({ trace, executionMs }: AgentTraceViewerProps) {
  const [open, setOpen] = useState(false)

  const toolCount = trace.length
  const hasCalls = toolCount > 0

  return (
    <div className="mt-1.5">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Terminal className="w-3 h-3" />
        <span>
          {hasCalls
            ? `エージェントトレース (${toolCount} ステップ)`
            : 'エージェントトレース'}
        </span>
        {executionMs !== undefined && (
          <span className="flex items-center gap-0.5 text-zinc-600">
            <Clock className="w-2.5 h-2.5" />
            {(executionMs / 1000).toFixed(1)}s
          </span>
        )}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Trace panel */}
      {open && (
        <div className="mt-1.5 rounded-lg border border-zinc-700/70 bg-zinc-900/80 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-700/50">
            <Terminal className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] font-medium text-zinc-400">実行ログ</span>
            {executionMs !== undefined && (
              <span className="ml-auto text-[10px] text-zinc-600 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                合計 {(executionMs / 1000).toFixed(2)}s
              </span>
            )}
          </div>

          {/* Entries */}
          {hasCalls ? (
            <div className="py-1">
              {trace.map((entry) => (
                <TraceEntryRow key={entry.seq} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-[11px] text-zinc-600 italic">
              ツール呼び出しなし（テキスト応答のみ）
            </div>
          )}
        </div>
      )}
    </div>
  )
}
