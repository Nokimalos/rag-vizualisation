import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function RankingPanel() {
  const data = usePipelineStore((s) => s.nodes.ranking.data)
  const status = usePipelineStore((s) => s.nodes.ranking.status)

  const skipped = data.skipped === true || status === 'idle'

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Re-ranking
        </h4>
        {skipped ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs text-gray-500 font-mono">Skipped / not configured</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
              <span className="text-xs text-neon-blue font-mono">Reranking applied</span>
            </div>
            {data.model != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono">Model</span>
                <span className="text-xs text-gray-200 font-mono">{String(data.model)}</span>
              </div>
            )}
            {data.top_k != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono">Top-K</span>
                <span className="text-xs text-gray-200 font-mono">{String(data.top_k)}</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
