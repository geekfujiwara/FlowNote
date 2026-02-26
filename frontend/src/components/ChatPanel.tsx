import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store'
import { MessageCircle, Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import SuggestionCard from './SuggestionCard'

interface ChatPanelProps {
  getToken: () => Promise<string>
}

export default function ChatPanel({ getToken }: ChatPanelProps) {
  const { chatMessages, agentStatus, pendingSuggestion, sendMessageToAgent } = useAppStore()
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessageToAgent(input, getToken)
    setInput('')
  }

  return (
    <div className={`absolute bottom-0 right-0 w-80 bg-gray-800 border-l border-t border-gray-700 flex flex-col shadow-2xl transition-all ${collapsed ? 'h-10' : 'h-96'}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none border-b border-gray-700"
        onClick={() => setCollapsed(!collapsed)}
      >
        <MessageCircle size={16} className="text-blue-400" />
        <span className="text-sm font-medium text-white flex-1">AI Assistant</span>
        {agentStatus === 'thinking' && <Loader2 size={14} className="animate-spin text-blue-400" />}
        {collapsed ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-4">Ask the AI to help build your flowchart</p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] text-xs rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {agentStatus === 'thinking' && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-400 text-xs rounded-lg px-3 py-2 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {pendingSuggestion && <SuggestionCard />}

          <div className="flex items-center gap-2 p-2 border-t border-gray-700">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask AI..."
              className="flex-1 bg-gray-700 text-white text-xs px-3 py-2 rounded-lg outline-none placeholder-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={agentStatus === 'thinking' || !input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
