import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import AppLayout from './components/AppLayout'
import LoginPage from './components/LoginPage'

interface AppProps {
  initError?: unknown
}

export default function App({ initError }: AppProps = {}) {
  if (initError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl w-96">
          <span className="text-3xl font-bold text-white">FlowNote</span>
          <p className="text-red-400 text-center text-sm">
            Authentication service failed to initialize.
          </p>
          <p className="text-gray-500 text-center text-xs">
            {initError instanceof Error ? initError.message : 'Please check your configuration and try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const { inProgress } = useMsal()

  if (inProgress === InteractionStatus.Startup || inProgress === InteractionStatus.HandleRedirect) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p role="status" aria-live="polite" className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <AuthenticatedTemplate>
        <AppLayout />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginPage />
      </UnauthenticatedTemplate>
    </>
  )
}
