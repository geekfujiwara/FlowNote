import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useStore } from '@/store/useStore'
import { negotiate } from '@/lib/mockApi'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'

export function useSignalR() {
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const onRemoteUpdate = useStore((s) => s.onRemoteUpdate)
  const setIsConnected = useStore((s) => s.setIsConnected)

  useEffect(() => {
    if (USE_MOCK) {
      // In mock mode, simulate occasional remote updates (disabled by default)
      setIsConnected(true)
      return () => {}
    }

    let mounted = true

    const connect = async () => {
      try {
        const token = await negotiate()
        if (!mounted || !token.url) return

        const connection = new signalR.HubConnectionBuilder()
          .withUrl(token.url, {
            accessTokenFactory: () => token.accessToken ?? '',
          })
          .withAutomaticReconnect()
          .configureLogging(signalR.LogLevel.Warning)
          .build()

        connection.on('noteUpdated', (noteId: string) => {
          onRemoteUpdate(noteId)
        })

        connection.onreconnecting(() => setIsConnected(false))
        connection.onreconnected(() => setIsConnected(true))
        connection.onclose(() => setIsConnected(false))

        await connection.start()
        if (mounted) {
          connectionRef.current = connection
          setIsConnected(true)
        }
      } catch (err) {
        console.error('[SignalR] connection failed', err)
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      mounted = false
      connectionRef.current?.stop()
      connectionRef.current = null
      setIsConnected(false)
    }
  }, [onRemoteUpdate, setIsConnected])
}
