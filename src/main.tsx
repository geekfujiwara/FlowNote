import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import '@/lib/appInsights' // initialize Application Insights (no-op if env var not set)

// ─────────────────────────────────────────────────────────────────────────────
// MSAL v5 ポップアップSSO: ポップアップコールバックウィンドウかどうかを判定
// ポップアップが redirectUri（= window.location.origin）に戻ると、
// index.html → main.tsx が再度ロードされる。このとき React をマウントせず
// broadcastResponseToMainFrame() を呼んでメインウィンドウに認証コードを送る。
// 参照: https://github.com/geekfujiwara/ClickThroughDemoBuilder/blob/main/docs/msal-v5-sso-implementation-guide.md
// ─────────────────────────────────────────────────────────────────────────────
function isMsalCallbackPopup(): boolean {
  const hash = window.location.hash
  const search = window.location.search
  const combined = hash + search

  // OAuth 認証コードレスポンス (code + state)
  const hasCodeResponse =
    /(^|[&#?])code=/.test(combined) && /(^|[&#?])state=/.test(combined)

  // 暗黙フローレスポンス (id_token or access_token)
  const hasTokenResponse =
    /(^|[&#?])(id_token|access_token)=/.test(combined)

  // エラーレスポンス
  const hasErrorResponse =
    /(^|[&#?])error=/.test(combined) && /(^|[&#?])state=/.test(combined)

  if (hasCodeResponse || hasTokenResponse || hasErrorResponse) return true

  // フォールバック: window.opener + state がある場合もポップアップと判断
  if (window.opener && /(^|[&#?])state=/.test(combined)) return true

  return false
}

if (isMsalCallbackPopup()) {
  // ─────────────────────────────────────────────────────────────────────
  // ★ ポップアップウィンドウ: React アプリをマウントしない
  //
  // @azure/msal-browser@3.x のポップアップフロー:
  //   メインウィンドウが setInterval でポップアップの location.hash を監視し、
  //   code=...&state=... を検出すると自動でポップアップを閉じる。
  //   ポップアップ側は URL ハッシュを「消費しないこと」だけが必要。
  //
  //   ❌ React アプリをマウントすると:
  //       - AuthGuard が login 画面にリダイレクト → ハッシュが消える
  //       - handleRedirectPromise() がハッシュを消費する
  //   ✅ 単に "処理中" を表示して待機するだけでよい
  // ─────────────────────────────────────────────────────────────────────
  const root = document.getElementById('root')
  if (root) {
    root.style.cssText =
      'display:flex;align-items:center;justify-content:center;height:100vh;background:#09090b;color:#a1a1aa;font-family:sans-serif;font-size:14px'
    root.textContent = 'サインイン処理中...'
  }
  // ウィンドウは MSAL がメインウィンドウから自動でクローズする
  // （タイムアウト保護として 30 秒後に自力でクローズ）
  setTimeout(() => window.close(), 30_000)
} else {
  // ─────────────────────────────────────────────────────────────────────
  // メインウィンドウ: 通常通り React アプリをマウント
  // ─────────────────────────────────────────────────────────────────────
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
