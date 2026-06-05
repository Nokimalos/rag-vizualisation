import { useTranslation } from 'react-i18next'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function PromptPanel() {
  const { t } = useTranslation()
  const data = usePipelineStore((s) => s.nodes.promptAssembly.data)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('panels.promptTitle')}
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.promptChunksInjected')}</span>
            <span className="text-xs text-foreground font-mono">
              {data.chunks_injected != null ? String(data.chunks_injected) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.promptTotalChars')}</span>
            <span className="text-xs text-foreground font-mono">
              {data.total_chars != null ? Number(data.total_chars).toLocaleString() : '—'}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
