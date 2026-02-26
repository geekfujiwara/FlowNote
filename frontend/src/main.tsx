import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './authConfig'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const MSAL_INIT_TIMEOUT_MS = 10_000

const msalInstance = new PublicClientApplication(msalConfig)
const root = ReactDOM.createRoot(document.getElementById('root')!)

function renderApp(initError?: unknown) {
  if (initError) {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App initError={initError} />
        </ErrorBoundary>
      </React.StrictMode>
    )
  } else {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <MsalProvider instance={msalInstance}>
            <App />
          </MsalProvider>
        </ErrorBoundary>
      </React.StrictMode>
    )
  }
}

const initPromise = msalInstance.initialize()
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Authentication initialization timed out.')), MSAL_INIT_TIMEOUT_MS)
)

Promise.race([initPromise, timeoutPromise])
  .then(() => renderApp())
  .catch((error) => renderApp(error))
