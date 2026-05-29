import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'
import { TokenStream } from '../viz/TokenStream'
import { ChunkRelevanceBar } from '../viz/ChunkRelevanceBar'
import { PerformanceTimeline } from '../viz/PerformanceTimeline'

export function GenerationPanel() {
  const tokens = usePipelineStore((s) => s.tokens)
  const nodeData = usePipelineStore((s) => s.nodes.generation.data)
  const latencyMs = usePipelineStore((s) => s.nodes.generation.latencyMs)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Generation
        </h4>
        <div className="flex flex-wrap gap-2">
          <MetricBadge
            label="model"
            value={(nodeData.model as string) ?? '—'}
            color="blue"
          />
          <MetricBadge
            label="tokens"
            value={tokens.length}
            color="purple"
          />
          <MetricBadge
            label="latency"
            value={latencyMs != null ? `${latencyMs}ms` : '—'}
            color="gold"
          />
        </div>
      </GlassCard>

      <TokenStream />
      <ChunkRelevanceBar />
      <PerformanceTimeline />
    </div>
  )
}
