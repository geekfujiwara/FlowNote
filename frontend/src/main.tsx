import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './authConfig'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const msalInstance = new PublicClientApplication(msalConfig)
const root = ReactDOM.createRoot(document.getElementById('root')!)

msalInstance
  .initialize()
  .then(() => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <MsalProvider instance={msalInstance}>
            <App />
          </MsalProvider>
        </ErrorBoundary>
      </React.StrictMode>
    )
  })
  .catch((error) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App initError={error} />
        </ErrorBoundary>
      </React.StrictMode>
    )
  })
