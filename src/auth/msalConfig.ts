import { Configuration, PublicClientApplication, LogLevel } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID as string
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID as string
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI ?? window.location.origin

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
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
