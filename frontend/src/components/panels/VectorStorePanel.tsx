import { useState, useEffect } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'
import { api } from '../../services/api'
import { useUIStore } from '../../stores/uiStore'
import type { ProviderInfo } from '../../types'

export function VectorStorePanel() {
  const activeCollection = useUIStore((s) => s.activeCollection)
  const [providers, setProviders] = useState<ProviderInfo | null>(null)
  const [embeddings, setEmbeddings] = useState<{ total: number } | null>(null)

  useEffect(() => {
    api.getProviders().then(setProviders).catch(() => {})
    api.getEmbeddings3D(activeCollection)
      .then((data) => setEmbeddings({ total: data.total }))
      .catch(() => {})
  }, [activeCollection])

  const activeVdb = providers?.vectordb.active ?? '—'
  const activeEmbed = providers?.embedding.active ?? '—'

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Vector Store
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Backend</span>
            <MetricBadge label="" value={activeVdb} color="emerald" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Embedding model</span>
            <MetricBadge label="" value={activeEmbed} color="purple" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Collection</span>
            <span className="text-xs text-gray-200 font-mono">default</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Total vectors</span>
            <span className="text-xs text-gray-200 font-mono">
              {embeddings?.total ?? '—'}
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Chunk embeddings are stored here for similarity search. When a query arrives, its embedding is compared against all stored vectors using cosine similarity to find the most relevant chunks.
        </p>
      </GlassCard>
    </div>
  )
}
