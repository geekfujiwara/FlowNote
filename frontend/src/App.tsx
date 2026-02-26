import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import AppLayout from './components/AppLayout'
import LoginPage from './components/LoginPage'

export default function App() {
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
