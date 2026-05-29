import { useEffect, useRef, useCallback } from 'react'
import type { WSMessage } from '../types'
import { useUIStore } from '../stores/uiStore'

interface UseWebSocketOptions { onMessage: (message: WSMessage) => void }

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempts = useRef(0)
  const disposed = useRef(false)
  const setWsConnected = useUIStore((s) => s.setWsConnected)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (disposed.current) return
    // Don't create a new connection if one is already open/connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/pipeline`)

      ws.onopen = () => {
        // connected
        setWsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data) as WSMessage)
        } catch (e) {
          console.error('[WebSocket] Message handling error:', e)
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        wsRef.current = null
        if (disposed.current) return
        // Minimum 3s, exponential backoff up to 30s
        const delay = Math.min(3000 * 2 ** reconnectAttempts.current, 30000)
        reconnectAttempts.current++
        // reconnecting
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onerror is always followed by onclose, so just let onclose handle reconnection
      }

      wsRef.current = ws
    } catch {
      // WebSocket constructor can throw if URL is invalid
      const delay = Math.min(3000 * 2 ** reconnectAttempts.current, 30000)
      reconnectAttempts.current++
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }
  }, [setWsConnected])

  useEffect(() => {
    disposed.current = false
    connect()
    return () => {
      disposed.current = true
      clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // prevent reconnect on cleanup close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data))
  }, [])

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN
  }, [])

  return { send, isConnected }
}
