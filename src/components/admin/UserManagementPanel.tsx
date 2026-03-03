import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X,
  Users,
  MessageSquare,
  FileText,
  Activity,
  Search,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Bot,
  Shield,
  Calendar,
  Zap,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useMsal } from '@azure/msal-react'
import { hasMsalConfig, loginRequest } from '@/auth/msalConfig'

// ─────────────────────────────────────────────────────────────
// Types – mirroring the backend API response shape
// ─────────────────────────────────────────────────────────────

interface DailyEntry { day: string; count: number }

interface ApiUser {
  email:             string
  totalEvents:       number
  lastActivity:      string | null
  firstActivity:     string | null
  activeDays:        number
  noteCreated:       number
  noteSaved:         number
  agentMessages:     number
  templateApplied:   number
  suggestionApplied: number
  dailyActivity:     DailyEntry[]
}

interface ApiResponse {
  users:  ApiUser[]
  source: string
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7071'

// ─────────────────────────────────────────────────────────────
// Micro helpers
// ─────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1)  return '1時間以内'
  if (h < 24) return `${h}時間前`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}日前`
  return `${Math.floor(d / 7)}週間前`
}

function OnlineBadge({ lastActivity }: { lastActivity: string | null }) {
  if (!lastActivity) return <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
  const h = (Date.now() - new Date(lastActivity).getTime()) / 3600000
  if (h < 1)  return <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="1時間以内にアクティブ" />
  if (h < 24) return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="本日アクティブ" />
  return <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" title="オフライン" />
}

// 30日スパークライン (ユーザーリスト用コンパクト版)
function Sparkline30({ dailyActivity }: { dailyActivity: DailyEntry[] }) {
  const today = new Date()
  const buckets = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return dailyActivity.find((e) => e.day === key)?.count ?? 0
  })
  const max = Math.max(...buckets, 1)
  const w = 140, h = 30
  const step = w / (buckets.length - 1)
  const pts = buckets.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`)
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkU" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkU)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#6366f1" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// 30日スパークライン (詳細ビュー用フル幅)
function FullSparkline({ dailyActivity }: { dailyActivity: DailyEntry[] }) {
  const today = new Date()
  const buckets = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return dailyActivity.find((e) => e.day === key)?.count ?? 0
  })
  const max = Math.max(...buckets, 1)
  const w = 320, h = 48
  const step = w / (buckets.length - 1)
  const pts = buckets.map((v, i) => `${i * step},${h - (v / max) * (h - 6)}`)
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkFull)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#6366f1" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all duration-700"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-zinc-400 w-8 text-right tabular-nums">{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail view
// ─────────────────────────────────────────────────────────────

function UserDetail({ user, allUsers, onBack }: {
  user: ApiUser
  allUsers: ApiUser[]
  onBack: () => void
}) {
  const maxMsgs   = Math.max(...allUsers.map((u) => u.agentMessages), 1)
  const maxNotes  = Math.max(...allUsers.map((u) => u.noteCreated), 1)
  const maxEvents = Math.max(...allUsers.map((u) => u.totalEvents), 1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <button onClick={onBack}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="一覧に戻る">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{user.email}</p>
          <p className="text-[11px] text-zinc-500 truncate">最終: {formatDate(user.lastActivity)}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <OnlineBadge lastActivity={user.lastActivity} />
          <span className="text-[11px] text-zinc-500">{timeAgo(user.lastActivity)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '総イベント数',   value: user.totalEvents,   icon: <Activity className="w-3.5 h-3.5" />,     color: '#6366f1' },
            { label: 'AIメッセージ',   value: user.agentMessages, icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#a78bfa' },
            { label: 'ノート作成',     value: user.noteCreated,   icon: <FileText className="w-3.5 h-3.5" />,      color: '#22d3ee' },
            { label: 'アクティブ日数', value: user.activeDays,    icon: <Calendar className="w-3.5 h-3.5" />,      color: '#34d399' },
          ].map((k) => (
            <div key={k.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5" style={{ color: k.color }}>
                {k.icon}
                <span className="text-[11px] text-zinc-400">{k.label}</span>
              </div>
              <span className="text-xl font-bold text-zinc-100">{k.value}</span>
            </div>
          ))}
        </div>

        {/* Basic info grid */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 grid grid-cols-2 gap-4 text-xs">
          {[
            { label: '初回アクティビティ', value: formatDate(user.firstActivity) },
            { label: '最終アクティビティ', value: formatDate(user.lastActivity) },
            { label: 'ノート保存回数',     value: `${user.noteSaved} 回` },
            { label: 'テンプレート利用',   value: `${user.templateApplied} 回` },
            { label: '提案適用数',         value: `${user.suggestionApplied} 回` },
            { label: 'アクティブ日数',     value: `${user.activeDays} 日` },
          ].map((r) => (
            <div key={r.label}>
              <div className="text-zinc-500 mb-0.5">{r.label}</div>
              <div className="text-zinc-200 font-medium">{r.value}</div>
            </div>
          ))}
        </div>

        {/* 30-day sparkline */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-zinc-300">過去30日間のイベント推移</span>
          </div>
          {user.dailyActivity.length > 0 ? (
            <>
              <FullSparkline dailyActivity={user.dailyActivity} />
              <p className="text-[11px] text-zinc-600 mt-2">アクティブ日数: {user.activeDays} 日 / 30日</p>
            </>
          ) : (
            <p className="text-xs text-zinc-600 py-3 text-center">データなし（まだイベントが記録されていません）</p>
          )}
        </div>

        {/* Relative comparison */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-300">全ユーザー内の相対位置</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'AIメッセージ数', value: user.agentMessages, max: maxMsgs },
              { label: 'ノート作成数',   value: user.noteCreated,   max: maxNotes },
              { label: '総イベント数',   value: user.totalEvents,   max: maxEvents },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-[11px] text-zinc-500 mb-1">{s.label}</div>
                <ActivityBar value={s.value} max={s.max} />
              </div>
            ))}
          </div>
        </div>

        {/* AI Usage */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-zinc-300">AI 利用状況</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'AIメッセージ', value: user.agentMessages,    color: '#a78bfa' },
              { label: '提案適用',     value: user.suggestionApplied, color: '#818cf8' },
              { label: 'テンプレ利用', value: user.templateApplied,   color: '#34d399' },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-800/60 rounded-lg p-3 text-center">
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export function UserManagementPanel({ onClose }: Props) {
  const { instance, accounts } = useMsal()
  const [users, setUsers]     = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [source, setSource]   = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null)
  const [query, setQuery]     = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // MSALが有効な場合はサイレントでIDトークンを取得（ポップアップ不要）
      let token = sessionStorage.getItem('msal_token') ?? ''
      if (hasMsalConfig && accounts.length > 0) {
        try {
          const silent = await instance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
          })
          token = silent.idToken ?? silent.accessToken
        } catch (silentErr) {
          console.warn('[UserMgmt] acquireTokenSilent failed:', silentErr)
        }
      }

      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/api/mgmt/analytics/users`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data: ApiResponse = await res.json()
      setUsers(data.users ?? [])
      setSource(data.source ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データ取得エラー')
    } finally {
      setLoading(false)
    }
  }, [instance, accounts])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return users.filter((u) => u.email.toLowerCase().includes(q))
  }, [query, users])

  const maxEvents   = Math.max(...users.map((u) => u.totalEvents), 1)
  const activeToday = users.filter(
    (u) => u.lastActivity && Date.now() - new Date(u.lastActivity).getTime() < 86400000,
  ).length

  return (
    /* ── centered modal overlay ─────────────────────────── */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-[90%] max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900 rounded-t-2xl">
          <Shield className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">ユーザー管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              システム管理者専用
              {source === 'application_insights' && ' · Azure Application Insights'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={fetchUsers} disabled={loading}
              className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 disabled:opacity-40 transition-colors"
              title="再読み込み">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              aria-label="閉じる">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {loading && (
          <div className="flex-1 flex items-center justify-center gap-3 text-zinc-400 py-16">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Application Insights からデータを取得中...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center py-16">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-zinc-300 font-medium">データ取得に失敗しました</p>
            <p className="text-xs text-zinc-500 max-w-sm">{error}</p>
            <button onClick={fetchUsers}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors">
              再試行
            </button>
          </div>
        )}

        {!loading && !error && (
          selectedUser ? (
            <UserDetail user={selectedUser} allUsers={users} onBack={() => setSelectedUser(null)} />
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3 px-6 pt-5 shrink-0">
                {[
                  { label: 'ログインユーザー数', value: users.length,      icon: <Users className="w-4 h-4" />,       color: 'text-indigo-400' },
                  { label: '本日アクティブ',     value: activeToday,        icon: <Activity className="w-4 h-4" />,    color: 'text-emerald-400' },
                  { label: '総AIメッセージ',     value: users.reduce((s, u) => s + u.agentMessages, 0),
                    icon: <MessageSquare className="w-4 h-4" />, color: 'text-purple-400' },
                ].map((k) => (
                  <div key={k.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 flex flex-col gap-1">
                    <div className={`flex items-center gap-1.5 ${k.color}`}>
                      {k.icon}
                      <span className="text-[11px] text-zinc-400">{k.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-zinc-100">{k.value}</span>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div className="px-6 pt-4 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="メールアドレスで検索..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              {/* User list */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                {filtered.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center py-8">
                    {users.length === 0
                      ? 'ユーザーデータがありません（Application Insights にイベントが記録されていない可能性があります）'
                      : 'ユーザーが見つかりません'}
                  </p>
                )}
                {filtered.map((user) => (
                  <button key={user.email} onClick={() => setSelectedUser(user)}
                    className="w-full text-left bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors p-4 group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <OnlineBadge lastActivity={user.lastActivity} />
                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">
                            {user.email}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mb-2">
                          初回: {formatDate(user.firstActivity)} · 最終: {timeAgo(user.lastActivity)}
                        </div>
                        <ActivityBar value={user.totalEvents} max={maxEvents} />
                      </div>
                      <div className="shrink-0 text-right hidden sm:flex flex-col items-end gap-1">
                        <Sparkline30 dailyActivity={user.dailyActivity} />
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-500">
                            <span className="text-zinc-300 font-medium">{user.agentMessages}</span> AIメッセージ
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            <span className="text-zinc-300 font-medium">{user.activeDays}</span> 日
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 shrink-0 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 mx-6 mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500 shrink-0">
                <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  データソース: <strong className="text-zinc-300">Azure Application Insights</strong>
                  {source !== 'application_insights' && ' (接続未設定のためデータがありません)'}
                  {' · '}過去90日間のイベントを集計
                </span>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
