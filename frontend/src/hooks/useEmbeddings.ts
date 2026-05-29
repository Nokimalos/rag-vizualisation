import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { EmbeddingPoint } from '../types'

interface UseEmbeddingsResult {
  points: EmbeddingPoint[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useEmbeddings(collection = 'default'): UseEmbeddingsResult {
  const [points, setPoints] = useState<EmbeddingPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEmbeddings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getEmbeddings3D(collection)
      setPoints(result.points)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch embeddings')
    } finally {
      setLoading(false)
    }
  }, [collection])

  useEffect(() => {
    fetchEmbeddings()
  }, [fetchEmbeddings])

  return { points, loading, error, refresh: fetchEmbeddings }
}
