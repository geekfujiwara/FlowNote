import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { SuggestionCard } from './SuggestionCard'
import { AgentTraceViewer } from './AgentTraceViewer'
import {
  Bot,
  User,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  Trash2,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { ChatMessage } from '@/types'
import { getTemplateById } from '@/lib/templates'

export function ChatPanel() {
  const chatMessages = useStore((s) => s.chatMessages)
  const agentStatus = useStore((s) => s.agentStatus)
  const pendingSuggestion = useStore((s) => s.pendingSuggestion)
  const sendMessage = useStore((s) => s.sendMessageToAgent)
  const currentNote = useStore((s) => s.currentNote)
  const clearChatMessages = useStore((s) => s.clearChatMessages)
  const activeTemplateId = useStore((s) => s.activeTemplateId)
  const systemPrompt = useStore((s) => s.systemPrompt)

  const [input, setInput] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeTemplate = activeTemplateId ? getTemplateById(activeTemplateId) : null

  const SUGGESTIONS: string[] = activeTemplate
    ? activeTemplate.userPromptSuggestions
    : [
        'レビューステップを追加して',
        'フローをシンプルにして',
        '並行処理フローに変更して',
        '現在のフローを説明して',
      ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, pendingSuggestion])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || agentStatus === 'thinking') return
    setInput('')
    sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-zinc-200">AI エージェント</span>
        {agentStatus === 'thinking' && (
          <Loader2 className="w-3.5 h-3.5 ml-auto animate-spin text-purple-400" />
        )}
        {agentStatus === 'error' && (
          <span className="ml-auto text-xs text-red-400">エラー</span>
        )}
        {chatMessages.length > 0 && agentStatus !== 'thinking' && (
          <button
            onClick={clearChatMessages}
            title="会話履歴をクリア"
            className="ml-auto p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active template badge + system prompt */}
      {activeTemplate && (
        <div className="border-b border-zinc-800 bg-zinc-900/80 shrink-0">
          <button
            onClick={() => setSystemPromptOpen(!systemPromptOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors"
          >
            <LayoutTemplate className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="text-[11px] text-indigo-300 flex-1 text-left truncate">
              {activeTemplate.emoji} {activeTemplate.name}
            </span>
            {systemPromptOpen
              ? <ChevronUp className="w-3 h-3 text-zinc-500" />
              : <ChevronDown className="w-3 h-3 text-zinc-500" />
            }
          </button>
          {systemPromptOpen && systemPrompt && (
            <div className="px-3 pb-2">
              <pre className="text-[10px] text-zinc-500 bg-zinc-800/60 rounded-lg p-2 border border-zinc-700 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {systemPrompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatMessages.length === 0 && !pendingSuggestion && (
          <EmptyState onSuggestion={(s) => { setInput(s); sendMessage(s) }} suggestions={SUGGESTIONS} />
        )}

        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {agentStatus === 'thinking' && <ThinkingIndicator />}

        {pendingSuggestion && (
          <SuggestionCard suggestion={pendingSuggestion} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3 shrink-0">
        {/* Quick suggestion chips */}
        {chatMessages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SUGGESTIONS.slice(0, 2).map((s) => (
              <button
                key={s}
                onClick={() => { sendMessage(s) }}
                className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full border border-zinc-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentNote ? 'フローについて質問...' : 'ノートを選択してください'}
            disabled={!currentNote || agentStatus === 'thinking'}
            rows={2}
            className="flex-1 bg-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600 rounded-lg px-3 py-2 resize-none outline-none border border-zinc-700 focus:border-indigo-600 transition-colors disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !currentNote || agentStatus === 'thinking'}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
            title="送信 (Enter)"
          >
            {agentStatus === 'thinking'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-1.5">Enter で送信 / Shift+Enter で改行</p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
          isUser ? 'bg-indigo-600' : 'bg-purple-700'
        }`}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-1 max-w-56 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>
        {/* Agent trace viewer – only for agent messages with trace data */}
        {!isUser && message.agentTrace !== undefined && (
          <div className="w-full px-1">
            <AgentTraceViewer
              trace={message.agentTrace}
              executionMs={message.executionMs}
            />
          </div>
        )}
        <span className="text-xs text-zinc-600">{time}</span>
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function EmptyState({
  suggestions,
  onSuggestion,
}: {
  suggestions: string[]
  onSuggestion: (s: string) => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-purple-900 flex items-center justify-center">
        <MessageSquare className="w-6 h-6 text-purple-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-300">AIエージェントに相談する</p>
        <p className="text-xs text-zinc-600 mt-1">フローの変更・説明・提案ができます</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-xs text-left px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors"
          >
            💬 {s}
          </button>
        ))}
      </div>
    </div>
  )
}
