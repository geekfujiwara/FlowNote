import React, { useMemo, useState } from 'react'
import {
  X,
  Users,
  MessageSquare,
  FileText,
  Layers,
  Activity,
  Search,
  ChevronRight,
  ChevronLeft,
  Clock,
  TrendingUp,
  Bot,
  Shield,
  Calendar,
  BarChart2,
  Zap,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UserActivity {
  id: string
  displayName: string
  email: string
  department: string
  lastLogin: string // ISO string
  firstLogin: string // ISO string
  totalLogins: number
  notesCreated: number
  totalChats: number
  aiChats: number
  totalNodes: number
  totalVersions: number
  avgSessionMinutes: number
  loginDates: string[] // ISO date strings for sparkline
}

// ─────────────────────────────────────────────────────────────
// Mock user data
// (In production these would come from Application Insights / Azure
//  AD audit logs via the backend API)
// ─────────────────────────────────────────────────────────────
const now = new Date()
function daysAgo(n: number) {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const MOCK_USERS: UserActivity[] = [
  {
    id: '1',
    displayName: 'Hiroshi Fujiwara',
    email: 'hfujiwara@microsoft.com',
    department: 'Engineering',
    lastLogin: daysAgo(0),
    firstLogin: daysAgo(90),
    totalLogins: 86,
    notesCreated: 32,
    totalChats: 248,
    aiChats: 210,
    totalNodes: 512,
    totalVersions: 134,
    avgSessionMinutes: 52,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.3),
  },
  {
    id: '2',
    displayName: 'Yuki Tanaka',
    email: 'ytanaka@microsoft.com',
    department: 'Design',
    lastLogin: daysAgo(1),
    firstLogin: daysAgo(60),
    totalLogins: 41,
    notesCreated: 18,
    totalChats: 112,
    aiChats: 89,
    totalNodes: 278,
    totalVersions: 67,
    avgSessionMinutes: 35,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.45),
  },
  {
    id: '3',
    displayName: 'Kenji Yamamoto',
    email: 'kyamamoto@microsoft.com',
    department: 'Product',
    lastLogin: daysAgo(3),
    firstLogin: daysAgo(45),
    totalLogins: 28,
    notesCreated: 11,
    totalChats: 67,
    aiChats: 54,
    totalNodes: 145,
    totalVersions: 39,
    avgSessionMinutes: 28,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.6),
  },
  {
    id: '4',
    displayName: 'Sakura Ito',
    email: 'sito@microsoft.com',
    department: 'Marketing',
    lastLogin: daysAgo(2),
    firstLogin: daysAgo(30),
    totalLogins: 19,
    notesCreated: 8,
    totalChats: 45,
    aiChats: 38,
    totalNodes: 96,
    totalVersions: 22,
    avgSessionMinutes: 21,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.65),
  },
  {
    id: '5',
    displayName: 'Daisuke Kobayashi',
    email: 'dkobayashi@microsoft.com',
    department: 'Sales',
    lastLogin: daysAgo(7),
    firstLogin: daysAgo(20),
    totalLogins: 9,
    notesCreated: 3,
    totalChats: 21,
    aiChats: 17,
    totalNodes: 42,
    totalVersions: 10,
    avgSessionMinutes: 15,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.75),
  },
  {
    id: '6',
    displayName: 'Natsuki Sato',
    email: 'nsato@microsoft.com',
    department: 'HR',
    lastLogin: daysAgo(0),
    firstLogin: daysAgo(14),
    totalLogins: 14,
    notesCreated: 6,
    totalChats: 33,
    aiChats: 28,
    totalNodes: 71,
    totalVersions: 18,
    avgSessionMinutes: 24,
    loginDates: Array.from({ length: 30 }, (_, i) => daysAgo(29 - i)).filter(() => Math.random() > 0.55),
  },
]

// ─────────────────────────────────────────────────────────────
// Micro helpers
// ─────────────────────────────────────────────────────────────

function Sparkline({ dates }: { dates: string[] }) {
  // Build 30-day bucket counts
  const buckets = Array.from({ length: 30 }, (_, i) => {
    const d = daysAgo(29 - i).slice(0, 10)
    return dates.filter((dt) => dt.slice(0, 10) === d).length
  })
  const max = Math.max(...buckets, 1)
  const w = 120
  const h = 28
  const step = w / (buckets.length - 1)
  const pts = buckets.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`)
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-grad)" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#6366f1"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StatRow({ label, value, color = '#a1a1aa' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-zinc-400 w-6 text-right tabular-nums">{value}</span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return '1時間以内'
  if (h < 24) return `${h}時間前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}日前`
  return `${Math.floor(d / 7)}週間前`
}

function OnlineBadge({ lastLogin }: { lastLogin: string }) {
  const h = (Date.now() - new Date(lastLogin).getTime()) / 3600000
  if (h < 1) return <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="1時間以内にアクティブ" />
  if (h < 24) return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="本日アクティブ" />
  return <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" title="オフライン" />
}

// ─────────────────────────────────────────────────────────────
// Detail view
// ─────────────────────────────────────────────────────────────

function UserDetail({ user, onBack }: { user: UserActivity; onBack: () => void }) {
  const maxChats = Math.max(...MOCK_USERS.map((u) => u.totalChats), 1)
  const maxNotes = Math.max(...MOCK_USERS.map((u) => u.notesCreated), 1)
  const maxNodes = Math.max(...MOCK_USERS.map((u) => u.totalNodes), 1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="一覧に戻る"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
          {user.displayName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{user.displayName}</p>
          <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <OnlineBadge lastLogin={user.lastLogin} />
          <span className="text-[11px] text-zinc-500">{timeAgo(user.lastLogin)}</span>
        </div>
      </div>

      {/* Scrollable detail body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Basic info */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-0">
          <StatRow label="部署" value={user.department} />
          <StatRow label="初回ログイン" value={formatDate(user.firstLogin)} />
          <StatRow label="最終ログイン" value={formatDate(user.lastLogin)} />
          <StatRow label="総ログイン回数" value={`${user.totalLogins} 回`} color="#818cf8" />
          <StatRow label="平均セッション時間" value={`${user.avgSessionMinutes} 分`} color="#34d399" />
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'ノート作成', value: user.notesCreated, icon: <FileText className="w-3.5 h-3.5" />, color: '#6366f1' },
            { label: 'チャット数', value: user.totalChats, icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#a78bfa' },
            { label: 'ノード数', value: user.totalNodes, icon: <Layers className="w-3.5 h-3.5" />, color: '#22d3ee' },
            { label: 'バージョン', value: user.totalVersions, icon: <TrendingUp className="w-3.5 h-3.5" />, color: '#f59e0b' },
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

        {/* 30日間ログイン推移 */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-zinc-300">過去30日間のログイン推移</span>
          </div>
          <Sparkline dates={user.loginDates} />
          <p className="text-[11px] text-zinc-600 mt-2">ログイン日数: {user.loginDates.length} 日 / 30日</p>
        </div>

        {/* 相対比較 */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-300">全ユーザー内の相対位置</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-zinc-500 mb-1">チャット数</div>
              <ActivityBar value={user.totalChats} max={maxChats} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 mb-1">ノート作成数</div>
              <ActivityBar value={user.notesCreated} max={maxNotes} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 mb-1">ノード総数</div>
              <ActivityBar value={user.totalNodes} max={maxNodes} />
            </div>
          </div>
        </div>

        {/* AI Usage */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-zinc-300">AI 利用状況</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/60 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-400">{user.aiChats}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">AIチャット</div>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-indigo-400">
                {user.totalChats > 0 ? Math.round((user.aiChats / user.totalChats) * 100) : 0}%
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">AI活用率</div>
            </div>
          </div>
        </div>

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

export function UserManagementPanel({ onClose }: Props) {
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return MOCK_USERS.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q),
    )
  }, [query])

  const maxLogins = Math.max(...MOCK_USERS.map((u) => u.totalLogins), 1)
  const totalUsers = MOCK_USERS.length
  const activeToday = MOCK_USERS.filter(
    (u) => Date.now() - new Date(u.lastLogin).getTime() < 86400000,
  ).length

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm">
      <div className="ml-auto w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 flex flex-col h-full overflow-hidden shadow-2xl">

        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900">
          <Shield className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">ユーザー管理</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              システム管理者専用 · ログイン済みユーザー一覧
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {selectedUser ? (
          <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3 px-5 pt-4 pb-0 shrink-0">
              {[
                { label: '総ユーザー数', value: totalUsers, icon: <Users className="w-4 h-4" />, color: 'text-indigo-400' },
                { label: '本日アクティブ', value: activeToday, icon: <Activity className="w-4 h-4" />, color: 'text-emerald-400' },
                {
                  label: '総チャット数',
                  value: MOCK_USERS.reduce((s, u) => s + u.totalChats, 0),
                  icon: <MessageSquare className="w-4 h-4" />,
                  color: 'text-purple-400',
                },
              ].map((k) => (
                <div key={k.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 flex flex-col gap-1">
                  <div className={`flex items-center gap-1.5 ${k.color}`}>
                    {k.icon}
                    <span className="text-[11px] text-zinc-400">{k.label}</span>
                  </div>
                  <span className="text-xl font-bold text-zinc-100">{k.value}</span>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="px-5 pt-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="名前・メール・部署で検索..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {filtered.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-8">ユーザーが見つかりません</p>
              )}
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="w-full text-left bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors p-4 group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                      {user.displayName.charAt(0)}
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <OnlineBadge lastLogin={user.lastLogin} />
                        <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">
                          {user.displayName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 shrink-0">
                          {user.department}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user.email}</p>
                      <div className="mt-2">
                        <ActivityBar value={user.totalLogins} max={maxLogins} />
                      </div>
                    </div>

                    {/* Stats column */}
                    <div className="shrink-0 text-right hidden sm:block">
                      <Sparkline dates={user.loginDates} />
                      <div className="flex items-center gap-3 mt-1 justify-end">
                        <span className="text-[11px] text-zinc-500">
                          <span className="text-zinc-300 font-medium">{user.totalChats}</span> チャット
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          最終: {timeAgo(user.lastLogin)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 shrink-0 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            {/* Footer note */}
            <div className="flex items-center gap-3 mx-5 mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500 shrink-0">
              <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                本データは <strong className="text-zinc-300">Azure Application Insights</strong> のログを元にしています。
                実データの取得には管理者 API との連携が必要です。
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
