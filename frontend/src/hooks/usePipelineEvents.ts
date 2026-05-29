import { useCallback } from 'react'
import type { WSMessage, PipelineMode } from '../types'
import { usePipelineStore } from '../stores/pipelineStore'
import { useUIStore } from '../stores/uiStore'
import { useWebSocket } from './useWebSocket'
import { api } from '../services/api'

export function usePipelineEvents() {
  const processEvent = usePipelineStore((s) => s.processEvent)
  const reset = usePipelineStore((s) => s.reset)
  const setResult = usePipelineStore((s) => s.setResult)
  const setQueryLoading = useUIStore((s) => s.setQueryLoading)

  const onMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'pipeline_event':
        processEvent(message)
        if (message.event === 'pipeline_complete') {
          setQueryLoading(false)
        }
        break
      case 'query_complete':
        // In streaming mode, events already updated the store (chunks, tokens, nodes).
        // Only use setResult for REST fallback where no events were received.
        setQueryLoading(false)
        break
      case 'error':
        console.error('[Pipeline] Server error:', message.data)
        setQueryLoading(false)
        break
    }
  }, [processEvent, setQueryLoading, setResult])

  const { send, isConnected } = useWebSocket({ onMessage })

  const startQuery = useCallback(async (text: string, mode: PipelineMode, collection = 'default') => {
    reset()
    setQueryLoading(true)

    if (isConnected()) {
      send({ type: 'start_query', payload: { text, mode, collection } })
    } else {
      try {
        const result = await api.runQuery(text, mode, collection)
        setResult(result)
      } catch (e) {
        console.error('[Pipeline] Query failed:', e)
      } finally {
        setQueryLoading(false)
      }
    }
  }, [send, reset, setResult, isConnected, setQueryLoading])

  const nextStep = useCallback(() => { send({ type: 'next_step' }) }, [send])
  const pause = useCallback(() => { send({ type: 'pause' }) }, [send])
  const resume = useCallback(() => { send({ type: 'resume' }) }, [send])
  const setSpeed = useCallback((speed: number) => { send({ type: 'set_speed', payload: { speed } }) }, [send])

  return { startQuery, nextStep, pause, resume, setSpeed }
}
