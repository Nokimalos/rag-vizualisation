import { Link } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { useUIStore } from '../../stores/uiStore'
import { GlassCard } from '../ui/GlassCard'
import { useEmbeddings } from '../../hooks/useEmbeddings'
import { EmbeddingSpace } from '../three/EmbeddingSpace'

export function EmbeddingPanel() {
  const activeCollection = useUIStore((s) => s.activeCollection)
  const data = usePipelineStore((s) => s.nodes.embedding.data)
  const { points } = useEmbeddings(activeCollection)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Embedding Info
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Model</span>
            <span className="text-xs text-gray-200 font-mono truncate ml-2 max-w-[160px]">
              {(data.model as string) ?? '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Vector Dim</span>
            <span className="text-xs text-gray-200 font-mono">
              {data.vector_dim != null ? String(data.vector_dim) : '—'}
            </span>
          </div>
        </div>
      </GlassCard>

      {points.length > 0 && (
        <GlassCard padding={false} className="relative overflow-hidden rounded-xl">
          <EmbeddingSpace points={points} className="h-[200px] rounded-xl overflow-hidden" />
          <Link
            to="/embeddings"
            className="absolute top-2 right-2 p-1.5 rounded-md glass hover:opacity-90 transition-opacity"
          >
            <Maximize2 className="w-3.5 h-3.5 text-gray-300" />
          </Link>
        </GlassCard>
      )}
    </div>
  )
}
