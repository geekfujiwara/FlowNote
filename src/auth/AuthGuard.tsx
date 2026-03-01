import React, { useEffect, useRef, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest, hasMsalConfig } from './msalConfig'
import { Eye, EyeOff, Layers, Lock, LogIn, Loader2 } from 'lucide-react'

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

const PW_SESSION_KEY = 'flownote_pw_auth'

interface Props {
  children: React.ReactNode
}

export function AuthGuard({ children }: Props) {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [loading, setLoading] = useState(true)
  const [pwAuthed, setPwAuthed] = useState(false)

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

        await instance.initialize()
        const result = await instance.handleRedirectPromise()
        if (result && result.accessToken) {
          sessionStorage.setItem('msal_token', result.accessToken)
        } else if (accounts.length > 0) {
          try {
            const silent = await instance.acquireTokenSilent({
              ...loginRequest,
              account: accounts[0],
            })
            sessionStorage.setItem('msal_token', silent.accessToken)
          } catch {
            // will prompt login
          }
        }
      } catch (err) {
        console.error('[AuthGuard]', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [instance, accounts])

  const handlePasswordSuccess = () => {
    sessionStorage.setItem(PW_SESSION_KEY, 'true')
    sessionStorage.setItem('msal_token', 'mock-token')
    setPwAuthed(true)
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

  const handleLogin = async () => {
    setLoading(true)
    try {
      await instance.loginRedirect(loginRequest)
    } catch (err) {
      console.error('[Auth] login failed', err)
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
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>{loading ? 'リダイレクト中...' : 'Microsoft でサインイン'}</span>
        </button>

        <p className="text-xs text-zinc-600 text-center">
          Microsoft Entra ID による認証が必要です
        </p>
      </div>
    </div>
  )
}
