import React, { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { VersionHistoryPanel } from '@/components/canvas/VersionHistoryPanel'
import { FlowMetadataPanel } from '@/components/shared/FlowMetadataPanel'
import { Bot, LayoutPanelLeft, Layers, MessageSquare, Menu, X, Wifi, WifiOff, History, BarChart2, LayoutTemplate } from 'lucide-react'
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { useMsal } from '@azure/msal-react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'

type ViewMode = 'default' | 'agent'

export function AppLayout() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const isConnected = useStore((s) => s.isConnected)
  const isSaving = useStore((s) => s.isSaving)
  const currentNote = useStore((s) => s.currentNote)
  const sendMessageToAgent = useStore((s) => s.sendMessageToAgent)
  const [chatOpen, setChatOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('agent')
  const [rightPanel, setRightPanel] = useState<'chat' | 'history'>('chat')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
  const { accounts } = useMsal()

  const userName = USE_MOCK ? 'Demo User' : (accounts[0]?.name ?? accounts[0]?.username ?? 'User')
  const isAgentMode = viewMode === 'agent'

  /** Called by TemplateGallery when user clicks "AIデザインで開始" */
  const handleTemplateAiStart = (_templateId: string, prompt: string) => {
    // Switch to agent mode so the chat is visible
    setViewMode('agent')
    setRightPanel('chat')
    // Small delay to let the template state settle before sending
    setTimeout(() => {
      sendMessageToAgent(prompt)
    }, 150)
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Hamburger – always visible */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            title={sidebarOpen ? 'ノート一覧を閉じる' : 'ノート一覧を開く'}
          >
            {sidebarOpen && isAgentMode
              ? <X className="w-4 h-4" />
              : <Menu className="w-4 h-4" />
            }
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm text-white">FlowNote</span>
          </div>
          {currentNote && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-sm text-zinc-300 max-w-48 truncate">{currentNote.title}</span>
            </>
          )}
          {isSaving && (
            <span className="text-xs text-zinc-500 animate-pulse">保存中...</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('default')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${
                !isAgentMode
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title="通常モード"
            >
              <LayoutPanelLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">通常</span>
            </button>
            <button
              onClick={() => setViewMode('agent')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors border-l border-zinc-700 ${
                isAgentMode
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title="エージェントデザインモード"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AIデザイン</span>
            </button>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected
              ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
            }
            <span className={isConnected ? 'text-emerald-400' : 'text-zinc-500'}>
              {isConnected ? '接続済み' : '未接続'}
            </span>
          </div>

          {/* Chat toggle – only shown in default mode */}
          {!isAgentMode && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-1.5 rounded-md transition-colors text-zinc-300 hover:text-white ${
                chatOpen ? 'bg-indigo-700 hover:bg-indigo-600' : 'hover:bg-zinc-700'
              }`}
              title="AIチャットを開く"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {/* Template gallery button */}
          <button
            onClick={() => setTemplateGalleryOpen(true)}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="テンプレートから開始"
          >
            <LayoutTemplate className="w-4 h-4" />
          </button>

          {/* Analytics button */}
          <button
            onClick={() => setAnalyticsOpen(true)}
            className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="利用状況アナリティクス"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          {/* User avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-700">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-medium text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-zinc-400 hidden sm:block max-w-24 truncate">{userName}</span>
          </div>
        </div>
      </header>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Default mode ─────────────────────────────────── */}
        {!isAgentMode && (
          <>
            {/* Sidebar */}
            <div
              className={`transition-all duration-300 overflow-hidden shrink-0 ${
                sidebarOpen ? 'w-64' : 'w-0'
              }`}
            >
              <Sidebar />
            </div>

            {/* Editor pane */}
            <div className="flex flex-col flex-1 min-w-0 border-r border-zinc-800">
              <MarkdownEditor />
            </div>

            {/* Canvas pane */}
            <div className="flex flex-col flex-1 min-w-0">
              <FlowMetadataPanel />
              <FlowCanvas />
            </div>

            {/* Chat panel */}
            <div
              className={`transition-all duration-300 overflow-hidden shrink-0 border-l border-zinc-800 ${
                chatOpen ? 'w-80' : 'w-0'
              }`}
            >
              <ChatPanel />
            </div>
          </>
        )}

        {/* ── Agent Design Mode ────────────────────────────── */}
        {isAgentMode && (
          <>
            {/* Canvas – takes up remaining space */}
            <div className="flex flex-col flex-1 min-w-0 relative">
              <FlowMetadataPanel />
              <FlowCanvas />
            </div>

            {/* Chat panel – always visible, slightly wider */}
            <div className="w-96 shrink-0 border-l border-zinc-800 flex flex-col">
              {/* Tab bar */}
              <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900">
                <button
                  onClick={() => setRightPanel('chat')}
                  className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    rightPanel === 'chat'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  AIチャット
                </button>
                <button
                  onClick={() => setRightPanel('history')}
                  className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    rightPanel === 'history'
                      ? 'border-amber-500 text-amber-300'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  履歴
                </button>
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {rightPanel === 'chat' ? <ChatPanel /> : <VersionHistoryPanel />}
              </div>
            </div>

            {/* Overlay drawer – note list */}
            {sidebarOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="absolute inset-0 z-20 bg-black/50"
                  onClick={() => setSidebarOpen(false)}
                />
                {/* Drawer */}
                <div className="absolute left-0 top-0 h-full w-72 z-30 bg-zinc-900 border-r border-zinc-700 shadow-2xl flex flex-col animate-slide-in-left">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
                    <span className="text-sm font-semibold text-zinc-200">ノート一覧</span>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Sidebar />
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>

      {/* Analytics overlay */}
      {analyticsOpen && <AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />}

      {/* Template gallery overlay */}
      {templateGalleryOpen && (
        <TemplateGallery
          onClose={() => setTemplateGalleryOpen(false)}
          onAiStart={handleTemplateAiStart}
        />
      )}
    </div>
  )
}
