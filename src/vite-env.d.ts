/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID: string
  readonly VITE_MSAL_TENANT_ID: string
  readonly VITE_MSAL_REDIRECT_URI: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK_API: string
  readonly VITE_USE_MOCK_AGENT: string
  readonly VITE_AGENT_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
