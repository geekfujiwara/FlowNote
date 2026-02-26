import { useEffect } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAppStore } from '../store'

export function useSignalR(getToken: () => Promise<string>) {
  const onRemoteUpdate = useAppStore((s) => s.onRemoteUpdate)

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/api/negotiate', {
        accessTokenFactory: getToken,
      })
      .withAutomaticReconnect()
      .build()

    connection.on('noteUpdated', (noteId: string) => {
      onRemoteUpdate(noteId, getToken)
    })

    connection
      .start()
      .then(() => useAppStore.setState({ isConnected: true }))
      .catch(() => useAppStore.setState({ isConnected: false }))

    connection.onreconnected(() => useAppStore.setState({ isConnected: true }))
    connection.onclose(() => useAppStore.setState({ isConnected: false }))

    return () => {
      connection.stop()
    }
  }, [])
}
