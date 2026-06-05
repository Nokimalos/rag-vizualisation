import { useTranslation } from 'react-i18next'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function RankingPanel() {
  const { t } = useTranslation()
  const data = usePipelineStore((s) => s.nodes.ranking.data)
  const status = usePipelineStore((s) => s.nodes.ranking.status)

  const skipped = data.skipped === true || status === 'idle'

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('panels.rankingTitle')}
        </h4>
        {skipped ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono">{t('panels.rankingSkipped')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-mono">{t('panels.rankingApplied')}</span>
            </div>
            {data.model != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-mono">{t('panels.rankingModel')}</span>
                <span className="text-xs text-foreground font-mono">{String(data.model)}</span>
              </div>
            )}
            {data.top_k != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-mono">{t('panels.rankingTopK')}</span>
                <span className="text-xs text-foreground font-mono">{String(data.top_k)}</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
