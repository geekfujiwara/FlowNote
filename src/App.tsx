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
    const init = async () => {
      try {
        await listNotes()
        const loaded = useStore.getState().notes
        if (loaded.length > 0) {
          await loadNote(loaded[0].id)
        } else {
          newNote()
        }
      } catch (err) {
        console.error('[AppInner] Failed to load notes:', err)
        newNote()
      }
    }
    init()
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
