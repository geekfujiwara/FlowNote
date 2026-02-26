import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import { GitBranch, LogIn } from 'lucide-react'

export default function LoginPage() {
  const { instance } = useMsal()

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(console.error)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl w-80">
        <div className="flex items-center gap-3">
          <GitBranch className="text-blue-400" size={36} />
          <span className="text-3xl font-bold text-white">FlowNote</span>
        </div>
        <p className="text-gray-400 text-center text-sm">Flowchart co-creation powered by AI</p>
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors w-full justify-center"
        >
          <LogIn size={18} />
          Sign in with Microsoft
        </button>
      </div>
    </div>
  )
}
