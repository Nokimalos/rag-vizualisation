import { useTranslation } from 'react-i18next'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { SimilarityMatrix } from '../viz/SimilarityMatrix'

export function RetrievalPanel() {
  const { t } = useTranslation()
  const chunks = usePipelineStore((s) => s.chunks)

  if (chunks.length === 0) {
    return (
      <GlassCard>
        <p className="text-xs text-muted-foreground font-mono text-center py-4">{t('panels.retrievalEmpty')}</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-2">
      {chunks.map((chunk, i) => (
        <GlassCard key={chunk.id ?? i}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
              <span className="text-[10px] font-mono text-success">
                {(chunk.score * 100).toFixed(1)}%
              </span>
            </div>
            {/* Score bar */}
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${chunk.score * 100}%` }}
              />
            </div>
            {/* Chunk text */}
            <p className="text-xs text-foreground font-sans line-clamp-3 leading-relaxed">
              {chunk.text}
            </p>
          </div>
        </GlassCard>
      ))}

      <SimilarityMatrix />
    </div>
  )
}
