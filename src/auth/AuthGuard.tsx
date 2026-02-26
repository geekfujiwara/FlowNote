import React, { useEffect, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from './msalConfig'
import { Layers, LogIn, Loader2 } from 'lucide-react'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'

interface Props {
  children: React.ReactNode
}

export function AuthGuard({ children }: Props) {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        if (USE_MOCK) {
          // In mock mode: skip real auth, inject a fake token
          sessionStorage.setItem('msal_token', 'mock-token')
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

  if (!USE_MOCK && !isAuthenticated) {
    return <LoginScreen />
  }

  return <>{children}</>
}

function LoginScreen() {
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
