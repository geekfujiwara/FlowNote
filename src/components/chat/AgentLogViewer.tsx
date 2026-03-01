import React, { useState } from 'react'
import { useStore } from '@/store/useStore'
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  ClipboardList,
} from 'lucide-react'
import type { AgentLog } from '@/types'

// ─────────────────────────────────────────────
// JSON syntax highlighter (plain React)
// ─────────────────────────────────────────────

function highlight(json: string): React.ReactNode[] {
  const tokenRe =
    /("(?:[^"\\]|\\.)*")\s*(:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],])/g

  const result: React.ReactNode[] = []
  let last = 0
  let key = 0

  for (const m of json.matchAll(tokenRe)) {
    if (m.index! > last) {
      result.push(json.slice(last, m.index))
    }
    last = m.index! + m[0].length

    const [full, str, colon, num, bool, punct] = m

    if (str !== undefined) {
      if (colon !== undefined) {
        // Object key
        result.push(
          <span key={key++} className="text-sky-300">{str}</span>,
          colon,
        )
      } else {
        // String value
        result.push(<span key={key++} className="text-amber-300">{full}</span>)
      }
    } else if (num !== undefined) {
      result.push(<span key={key++} className="text-emerald-300">{num}</span>)
    } else if (bool !== undefined) {
      result.push(<span key={key++} className="text-purple-300">{bool}</span>)
    } else if (punct !== undefined) {
      result.push(<span key={key++} className="text-zinc-400">{punct}</span>)
    } else {
      result.push(full)
    }
  }

  if (last < json.length) result.push(json.slice(last))
  return result
}

// ─────────────────────────────────────────────
// Copy button
// ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      title="クリップボードにコピー"
      className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  )
}

// ─────────────────────────────────────────────
// JSON pane
// ─────────────────────────────────────────────

function JsonPane({ data }: { data: Record<string, unknown> | null }) {
  if (data === null) {
    return (
      <div className="text-xs text-zinc-500 italic p-4 text-center">
        レスポンスなし（エラー）
      </div>
    )
  }
  const pretty = JSON.stringify(data, null, 2)
  return (
    <pre className="text-[11px] leading-relaxed p-3 overflow-auto max-h-72 whitespace-pre-wrap break-all font-mono">
      {highlight(pretty)}
    </pre>
  )
}

// ─────────────────────────────────────────────
// Single log entry
// ─────────────────────────────────────────────

type LogTab = 'request' | 'response'

function LogEntry({ log }: { log: AgentLog }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<LogTab>('response')

  const time = new Date(log.timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const activeJson = tab === 'request' ? log.requestPayload : log.responsePayload
  const jsonStr = JSON.stringify(activeJson, null, 2)

  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/60 transition-colors text-left"
      >
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        }
        <span className="text-xs text-zinc-400 font-mono shrink-0">{time}</span>
        <span className="text-xs text-zinc-200 flex-1 truncate">
          {log.message}
        </span>
        {log.errorMessage ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        ) : (
          <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
            {log.durationMs}ms
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-zinc-700/60">
          {/* Error banner */}
          {log.errorMessage && (
            <div className="px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {log.errorMessage}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-zinc-700/60 px-2 pt-1">
            {(['request', 'response'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                  tab === t
                    ? 'text-indigo-300 border-b-2 border-indigo-500 -mb-px bg-transparent'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'request' ? 'リクエスト' : 'レスポンス'}
              </button>
            ))}
            <div className="flex-1" />
            {activeJson !== null && (
              <CopyButton text={jsonStr} />
            )}
          </div>

          {/* JSON body */}
          <div className="bg-zinc-950">
            <JsonPane data={activeJson} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function AgentLogViewer() {
  const agentLogs = useStore((s) => s.agentLogs)
  const clearAgentLogs = useStore((s) => s.clearAgentLogs)

  if (agentLogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-400">ログなし</p>
          <p className="text-xs text-zinc-600 mt-1">
            エージェントにメッセージを送ると<br />リクエスト・レスポンスが記録されます
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Subheader */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-400">
          <span className="font-medium text-zinc-200">{agentLogs.length}</span> 件
        </span>
        <div className="flex-1" />
        <button
          onClick={clearAgentLogs}
          title="ログをクリア"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-xs">クリア</span>
        </button>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {agentLogs.map((log) => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  )
}
