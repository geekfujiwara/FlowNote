import Sidebar from './Sidebar'
import Editor from './Editor'
import FlowCanvas from './FlowCanvas'
import ChatPanel from './ChatPanel'
import FlowMetadataPanel from './FlowMetadataPanel'
import { useSignalR } from '../hooks/useSignalR'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'

export default function AppLayout() {
  const { instance, accounts } = useMsal()

  const getToken = async (): Promise<string> => {
    try {
      const result = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      })
      return result.accessToken
    } catch {
      const result = await instance.acquireTokenPopup(loginRequest)
      return result.accessToken
    }
  }

  useSignalR(getToken)

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar getToken={getToken} />
      <div className="flex flex-1 overflow-hidden flex-col">
        <FlowMetadataPanel />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col border-r border-gray-700 min-w-0">
            <Editor getToken={getToken} />
          </div>
          <div className="flex-1 flex flex-col min-w-0 relative">
            <FlowCanvas />
            <ChatPanel getToken={getToken} />
          </div>
        </div>
      </div>
    </div>
  )
}
