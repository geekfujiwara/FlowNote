import React, { useEffect } from 'react'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from '@/auth/msalConfig'
import { AuthGuard } from '@/auth/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { useStore } from '@/store/useStore'
import { useSignalR } from '@/hooks/useSignalR'

function AppInner() {
  const listNotes = useStore((s) => s.listNotes)
  const notes = useStore((s) => s.notes)
  const loadNote = useStore((s) => s.loadNote)
  const newNote = useStore((s) => s.newNote)

  useSignalR()

  useEffect(() => {
    listNotes().then(() => {
      const loaded = useStore.getState().notes
      if (loaded.length > 0) {
        loadNote(loaded[0].id)
      } else {
        newNote()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AppLayout />
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthGuard>
        <AppInner />
      </AuthGuard>
    </MsalProvider>
  )
}
