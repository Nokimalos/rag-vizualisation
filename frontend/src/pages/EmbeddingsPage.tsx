import { Loader2, RefreshCw, Box } from 'lucide-react'
import { useEmbeddings } from '../hooks/useEmbeddings'
import { EmbeddingSpace } from '../components/three/EmbeddingSpace'
import { GlassCard } from '../components/ui/GlassCard'
import { useUIStore } from '../stores/uiStore'

export function EmbeddingsPage() {
  const activeCollection = useUIStore((s) => s.activeCollection)
  const { points, loading, error, refresh } = useEmbeddings(activeCollection)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border glass">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-neon-purple" />
          <span className="text-sm font-mono font-semibold text-gray-200">
            Embedding Space Explorer
          </span>
          {points.length > 0 && (
            <span className="text-xs font-mono text-gray-500 ml-1">
              {points.length} vectors
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-md hover:bg-glass-bg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs font-mono hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <GlassCard className="max-w-md w-full">
              <p className="text-sm text-red-400 font-mono mb-2">{error}</p>
              <p className="text-xs text-gray-500 font-mono">
                Make sure the backend is running and accessible.
              </p>
            </GlassCard>
          </div>
        )}

        {!loading && !error && points.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-6">
            <GlassCard className="max-w-md w-full">
              <p className="text-sm text-gray-400 font-mono text-center">
                No embeddings yet. Upload documents first.
              </p>
            </GlassCard>
          </div>
        )}

        {!loading && !error && points.length > 0 && (
          <EmbeddingSpace points={points} className="flex-1" />
        )}
      </div>
    </div>
  )
}
