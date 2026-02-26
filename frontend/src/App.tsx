import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react'
import AppLayout from './components/AppLayout'
import LoginPage from './components/LoginPage'

export default function App() {
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
