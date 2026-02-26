import { useIsAuthenticated } from '@azure/msal-react'
import LoginPage from './LoginPage'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useIsAuthenticated()
  if (!isAuthenticated) return <LoginPage />
  return <>{children}</>
}
