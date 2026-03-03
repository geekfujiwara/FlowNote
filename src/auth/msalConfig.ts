import { Configuration, PublicClientApplication, LogLevel } from '@azure/msal-browser'

// VITE_ENTRA_CLIENT_ID（推奨）または VITE_MSAL_CLIENT_ID（後方互換）を使用
const clientId = (
  import.meta.env.VITE_ENTRA_CLIENT_ID ||
  import.meta.env.VITE_MSAL_CLIENT_ID
) as string | undefined
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID as string | undefined

/**
 * VITE_ENTRA_CLIENT_ID（または VITE_MSAL_CLIENT_ID）が設定されている場合に true。
 * テナント ID は任意。未設定時は /common エンドポイント（マルチテナント）を使用。
 */
export const hasMsalConfig = !!clientId

/**
 * ★ ポップアップコールバックウィンドウかどうかを判定。
 * main.tsx でも同様の判定をするが、MSAL 初期化の eager init ガードにも使用。
 */
export function isPopupCallbackWindow(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return /(^|[&#?])code=/.test(hash) && /(^|[&#?])state=/.test(hash)
}

// When MSAL credentials are absent, use a placeholder so PublicClientApplication
// can be instantiated (required by MsalProvider/useMsal hooks) without crashing.
// The placeholder instance is never used for actual auth operations; AuthGuard
// routes to password-based auth instead when hasMsalConfig is false.
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || '00000000-0000-0000-0000-000000000000',
    // ★ tenantId が未設定の場合は common（マルチテナント）を使用
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : 'https://login.microsoftonline.com/common',
    // ★ redirectUri は window.location.origin のみ（パスなし）
    //   Entra アプリ登録の SPA リダイレクト URI と完全一致させること
    redirectUri: window.location.origin,
  },
  cache: {
    // ★ ポップアップとメインウィンドウ間でキャッシュを分離するため sessionStorage を使用
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error('[MSAL]', message)
      },
    },
  },
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

// ★ ポップアップコールバックウィンドウでは MSAL インスタンスを初期化しない
//   (MsalProvider がレンダーされないため initialize() は呼ばれない)
export const msalInstance = new PublicClientApplication(msalConfig)
