import { Configuration, PublicClientApplication, LogLevel } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID as string | undefined
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID as string | undefined
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI ?? window.location.origin

/** True only when both clientId and tenantId are provided at build time. */
export const hasMsalConfig = !!(clientId && tenantId)

// When MSAL credentials are absent, use a placeholder so PublicClientApplication
// can be instantiated (required by MsalProvider/useMsal hooks) without crashing.
// The placeholder instance is never used for actual auth operations; AuthGuard
// routes to password-based auth instead when hasMsalConfig is false.
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || '00000000-0000-0000-0000-000000000000',
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri,
  },
  cache: {
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

export const msalInstance = new PublicClientApplication(msalConfig)
