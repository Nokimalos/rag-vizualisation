import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../ui/GlassCard'
import { useUIStore } from '../../stores/uiStore'
import { api } from '../../services/api'

export function ChunkingPanel() {
  const { t } = useTranslation()
  const activeCollection = useUIStore((s) => s.activeCollection)
  const [totalChunks, setTotalChunks] = useState(0)

  useEffect(() => {
    api.getEmbeddings3D(activeCollection)
      .then((data) => setTotalChunks(data.total))
      .catch(() => setTotalChunks(0))
  }, [activeCollection])

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('panels.chunkingTitle')}
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.chunkingStrategy')}</span>
            <span className="text-xs text-primary font-mono">hybrid</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.chunkingMethod')}</span>
            <span className="text-xs text-foreground font-mono">{t('panels.chunkingMethodValue')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.chunkingMaxSize')}</span>
            <span className="text-xs text-foreground font-mono">{t('panels.chunkingMaxSizeValue')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.totalChunks')}</span>
            <span className="text-xs text-foreground font-mono">{totalChunks}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t('panels.chunkingDescription')}
        </p>
      </GlassCard>
    </div>
  )
}
