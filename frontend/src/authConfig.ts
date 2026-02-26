import type { Configuration, PopupRequest } from '@azure/msal-browser'

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || 'placeholder-client-id',
    authority: import.meta.env.VITE_MSAL_AUTHORITY || 'https://login.microsoftonline.com/common',
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
}

export const loginRequest: PopupRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    ...(import.meta.env.VITE_API_SCOPE ? [import.meta.env.VITE_API_SCOPE] : []),
  ],
}
