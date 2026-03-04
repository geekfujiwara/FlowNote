import React, { useEffect, useRef, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest, hasMsalConfig } from './msalConfig'
import { Eye, EyeOff, Github, Layers, Lock, LogIn, Loader2 } from 'lucide-react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'
// Use password auth in mock mode OR when MSAL credentials are not configured
const USE_PASSWORD_AUTH = USE_MOCK || !hasMsalConfig

// Password hash is configured via VITE_PASSWORD_HASH environment variable (SHA-256)
const CORRECT_HASH = import.meta.env.VITE_PASSWORD_HASH ?? ''
if (USE_PASSWORD_AUTH && !CORRECT_HASH) {
  console.warn('[AuthGuard] VITE_PASSWORD_HASH is not set. Password login will not work. Set it to the SHA-256 hash of your desired password in .env.local.')
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const PW_SESSION_KEY = 'flownote_pw_auth'

/**
 * パスワード認証モードでログアウト関数を提供する Context。
 * MSAL モードでは null。AppLayout から useAuthLogout() で消費する。
 */
export const AuthLogoutContext = React.createContext<(() => void) | null>(null)
export function useAuthLogout() {
  return React.useContext(AuthLogoutContext)
}

interface Props {
  children: React.ReactNode
}

export function AuthGuard({ children }: Props) {
  const { instance } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [loading, setLoading] = useState(true)
  const [pwAuthed, setPwAuthed] = useState(false)

  // ページロード時: キャッシュ済みアカウントがあればサイレントでトークンを取得
  useEffect(() => {
    const init = async () => {
      try {
        if (USE_PASSWORD_AUTH) {
          // In password-auth mode: restore session from sessionStorage
          const stored = sessionStorage.getItem(PW_SESSION_KEY)
          if (stored === 'true') {
            sessionStorage.setItem('msal_token', 'mock-token')
            setPwAuthed(true)
          }
          setLoading(false)
          return
        }

        // ★ ポップアップフローでは handleRedirectPromise() は不要（呼ぶとハッシュが消費される）
        // ★ initialize() は MsalProvider が内部で呼ぶため、ここでは呼ばない
        // キャッシュ済みアカウントがあればサイレントでトークンを取得
        const allAccounts = instance.getAllAccounts()
        if (allAccounts.length > 0) {
          try {
            const silent = await instance.acquireTokenSilent({
              ...loginRequest,
              account: allAccounts[0],
            })
            sessionStorage.setItem(
              'msal_token',
              silent.idToken || silent.accessToken
            )
          } catch {
            // サイレント取得失敗 → ログイン画面を表示
          }
        }
      } catch (err) {
        console.error('[AuthGuard]', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance])

  // loginPopup 成功後: isAuthenticated が true になった時点でトークンを取得してセット
  useEffect(() => {
    if (!isAuthenticated || USE_PASSWORD_AUTH) return
    const acquireToken = async () => {
      try {
        const allAccounts = instance.getAllAccounts()
        if (allAccounts.length === 0) return
        const silent = await instance.acquireTokenSilent({
          ...loginRequest,
          account: allAccounts[0],
        })
        sessionStorage.setItem(
          'msal_token',
          silent.idToken ?? silent.accessToken
        )
      } catch (err) {
        console.warn('[AuthGuard] acquireTokenSilent after login failed:', err)
      }
    }
    acquireToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handlePasswordSuccess = () => {
    sessionStorage.setItem(PW_SESSION_KEY, 'true')
    sessionStorage.setItem('msal_token', 'mock-token')
    setPwAuthed(true)
  }

  const handlePasswordLogout = () => {
    sessionStorage.removeItem(PW_SESSION_KEY)
    sessionStorage.removeItem('msal_token')
    setPwAuthed(false)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <span className="text-sm">起動中...</span>
        </div>
      </div>
    )
  }

  if (USE_PASSWORD_AUTH && !pwAuthed) {
    return <PasswordLoginScreen onSuccess={handlePasswordSuccess} />
  }

  if (!USE_PASSWORD_AUTH && !isAuthenticated) {
    return <MsalLoginScreen />
  }

  // ログアウトボタンを children に渡すため AuthContext 経由で提供する代わりに、
  // PasswordAuth モードのログアウトはここで処理し、MSAL ログアウトは AppLayout で処理
  if (USE_PASSWORD_AUTH && pwAuthed) {
    return (
      <AuthLogoutContext.Provider value={handlePasswordLogout}>
        {children}
      </AuthLogoutContext.Provider>
    )
  }

  return <>{children}</>
}

// ─────────────────────────────────────────────
// Password login screen (mock / demo mode)
// ─────────────────────────────────────────────

function PasswordLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const hash = await sha256(password)
    if (hash === CORRECT_HASH) {
      onSuccess()
    } else {
      setError('パスワードが正しくありません')
      setPassword('')
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-8 p-10 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-w-sm w-full mx-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">FlowNote</h1>
            <p className="text-xs text-zinc-400">AI-powered flowcharts</p>
          </div>
        </div>

        {/* Description */}
        <div className="text-center">
          <p className="text-zinc-300 text-sm leading-relaxed">
            マークダウンとキャンバス、AIエージェントで<br />
            フローチャートを共同編集できます。
          </p>
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pw-input" className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              パスワード
            </label>
            <div className="relative">
              <input
                id="pw-input"
                ref={inputRef}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示する'}
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{loading ? '認証中...' : 'ログイン'}</span>
          </button>
        </form>

        {/* GitHub link */}
        <a
          href="https://github.com/geekfujiwara/FlowNote"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          geekfujiwara/FlowNote
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Microsoft Entra ID login screen (production)
// ─────────────────────────────────────────────

function MsalLoginScreen() {
  const { instance } = useMsal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      // ★ loginRedirect ではなく loginPopup を使用（MSAL v5 ポップアップSSO）
      await instance.loginPopup(loginRequest)
      // loginPopup が resolve すると useIsAuthenticated() が true になり
      // AuthGuard が children をレンダーする
    } catch (err: unknown) {
      console.error('[Auth] login failed', err)
      // interaction_in_progress エラーの場合はセッションをクリア
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('interaction_in_progress')) {
        // 前回の認証が途中で中断された場合、sessionStorage の interaction.status を削除
        Object.keys(sessionStorage)
          .filter((k) => k.includes('interaction.status'))
          .forEach((k) => sessionStorage.removeItem(k))
        setError('前回のサインインが中断されました。再度お試しください。')
      } else if (msg.includes('popup_window_error') || msg.includes('user_cancelled')) {
        setError('サインインがキャンセルされました。')
      } else {
        setError('サインインに失敗しました。再度お試しください。')
      }
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-8 p-10 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-w-sm w-full mx-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">FlowNote</h1>
            <p className="text-xs text-zinc-400">AI-powered flowcharts</p>
          </div>
        </div>

        {/* Description */}
        <div className="text-center">
          <p className="text-zinc-300 text-sm leading-relaxed">
            マークダウンとキャンバス、AIエージェントで<br />
            フローチャートを共同編集できます。
          </p>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>{loading ? 'サインイン中...' : 'Microsoft でサインイン'}</span>
        </button>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="text-xs text-zinc-600 text-center">
          Microsoft Entra ID による認証が必要です
        </p>

        {/* GitHub link */}
        <a
          href="https://github.com/geekfujiwara/FlowNote"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          geekfujiwara/FlowNote
        </a>
      </div>
    </div>
  )
}
