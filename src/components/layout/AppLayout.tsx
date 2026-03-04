import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { VersionHistoryPanel } from '@/components/canvas/VersionHistoryPanel'
import { FlowMetadataPanel } from '@/components/shared/FlowMetadataPanel'
import { Bot, Github, LayoutPanelLeft, Layers, MessageSquare, Menu, X, Wifi, WifiOff, History, BarChart2, LayoutTemplate, ClipboardList, LogOut, ChartNoAxesColumn } from 'lucide-react'
import { AgentLogViewer } from '@/components/chat/AgentLogViewer'
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel'
import { UserManagementPanel } from '@/components/admin/UserManagementPanel'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { useMsal } from '@azure/msal-react'
import { useAuthLogout } from '@/auth/AuthGuard'
import { setAuthenticatedUserContext, clearAuthenticatedUserContext } from '@/lib/appInsights'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'

type ViewMode = 'default' | 'agent'

export function AppLayout() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const isConnected = useStore((s) => s.isConnected)
  const isSaving = useStore((s) => s.isSaving)
  const currentNote = useStore((s) => s.currentNote)
  const newNote = useStore((s) => s.newNote)
  const renameNote = useStore((s) => s.renameNote)
  const sendMessageToAgent = useStore((s) => s.sendMessageToAgent)
  const [chatOpen, setChatOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('agent')
  const [rightPanel, setRightPanel] = useState<'chat' | 'history' | 'log'>('chat')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [userMgmtOpen, setUserMgmtOpen] = useState(false)
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { instance, accounts } = useMsal()
  const passwordLogout = useAuthLogout()

  const userName = USE_MOCK ? 'Demo User' : (accounts[0]?.name ?? accounts[0]?.username ?? 'User')

  // システム管理者チェック (VITE_ADMIN_EMAILS 環境変数で設定)
  const userEmail = USE_MOCK
    ? ''
    : (
        accounts[0]?.username ||
        (accounts[0]?.idTokenClaims?.preferred_username as string | undefined) ||
        ''
      ).toLowerCase()
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
  // モック時は管理者ボタンを常に表示（開発・デモ用）
  const isAdmin = USE_MOCK ? adminEmails.length > 0 : adminEmails.length > 0 && adminEmails.includes(userEmail)

  // App Insights に認証済みユーザーを登録
  useEffect(() => {
    if (userEmail) {
      setAuthenticatedUserContext(userEmail)
    } else {
      clearAuthenticatedUserContext()
    }
  }, [userEmail])

  // ログアウト処理:
  //   パスワード認証モード → AuthLogoutContext 経由で sessionStorage をクリア
  //   MSAL モード   → instance.logoutRedirect() でリダイレクトログアウト（ポップアップなし）
  const handleLogout = useCallback(async () => {
    if (passwordLogout) {
      passwordLogout()
      return
    }
    try {
      await instance.logoutRedirect()
    } catch (err) {
      console.error('[Auth] logout failed', err)
      // フォールバック: セッションをクリアしてリロード
      sessionStorage.clear()
      window.location.reload()
    }
  }, [instance, passwordLogout])
  const isAgentMode = viewMode === 'agent'

  /** Called by TemplateGallery when user selects a prompt suggestion.
   *  The template is NOT applied – the prompt runs on the current flow. */
  const handleTemplateRunPrompt = (_templateId: string, prompt: string) => {
    // Switch to agent mode so the chat is visible
    setViewMode('agent')
    setRightPanel('chat')
    // Small delay to let the gallery close animation finish
    setTimeout(() => {
      sendMessageToAgent(prompt)
    }, 150)
  }

  const startTitleEdit = () => {
    if (!currentNote) return
    setEditTitleValue(currentNote.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 50)
  }

  const commitTitleEdit = () => {
    if (currentNote && editTitleValue.trim() && editTitleValue.trim() !== currentNote.title) {
      renameNote(currentNote.id, editTitleValue.trim())
    }
    setEditingTitle(false)
  }

  const cancelTitleEdit = () => setEditingTitle(false)

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
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onBlur={commitTitleEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitleEdit()
                    if (e.key === 'Escape') cancelTitleEdit()
                  }}
                  autoFocus
                  aria-label="フロー名"
                  placeholder="フロー名を入力"
                  className="text-sm bg-zinc-800 text-zinc-100 px-2 py-0.5 rounded border border-indigo-500 outline-none max-w-48"
                />
              ) : (
                <span
                  className="text-sm text-zinc-300 max-w-48 truncate cursor-pointer hover:text-white hover:underline underline-offset-2 decoration-dotted"
                  onDoubleClick={startTitleEdit}
                  title="ダブルクリックで名前変更"
                >
                  {currentNote.title}
                </span>
              )}
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

          {/* User management button – admin only */}
          {isAdmin && (
            <button
              onClick={() => setUserMgmtOpen(true)}
              className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="ユーザー管理 (管理者専用)"
            >
              <ChartNoAxesColumn className="w-4 h-4" />
            </button>
          )}

          {/* GitHub repository link */}
          <a
            href="https://github.com/geekfujiwara/FlowNote"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="GitHubリポジトリ"
            aria-label="GitHubリポジトリ"
          >
            <Github className="w-4 h-4" />
          </a>

          {/* User avatar + logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-700">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-zinc-400 hidden sm:block max-w-24 truncate">{userName}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors"
              title="ログアウト"
              aria-label="ログアウト"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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
              <Sidebar onNewNote={() => setTemplateGalleryOpen(true)} />
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
              <ChatPanel onOpenTemplates={() => setTemplateGalleryOpen(true)} />
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
                <button
                  onClick={() => setRightPanel('log')}
                  className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    rightPanel === 'log'
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  ログ
                </button>
                {/* Analytics popup button */}
                <button
                  onClick={() => setAnalyticsOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium transition-colors border-b-2 border-transparent text-zinc-500 hover:text-zinc-300 shrink-0"
                  title="利用状況アナリティクス"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">分析</span>
                </button>
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {rightPanel === 'chat' ? <ChatPanel onOpenTemplates={() => setTemplateGalleryOpen(true)} /> : rightPanel === 'history' ? <VersionHistoryPanel /> : <AgentLogViewer />}
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
                      aria-label="サイドバーを閉じる"
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Sidebar onNewNote={() => { setSidebarOpen(false); setTemplateGalleryOpen(true) }} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>

      {/* Analytics overlay */}
      {analyticsOpen && <AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />}

      {/* User management overlay – admin only */}
      {userMgmtOpen && <UserManagementPanel onClose={() => setUserMgmtOpen(false)} />}

      {/* Template gallery overlay */}
      {templateGalleryOpen && (
        <TemplateGallery
          onClose={() => setTemplateGalleryOpen(false)}
          onRunPrompt={handleTemplateRunPrompt}
          onBlankCreate={newNote}
        />
      )}
    </div>
  )
}
