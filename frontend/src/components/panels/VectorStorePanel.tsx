import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'
import { api } from '../../services/api'
import { useUIStore } from '../../stores/uiStore'
import type { ProviderInfo } from '../../types'

export function VectorStorePanel() {
  const { t } = useTranslation()
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
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('panels.vectorStoreTitle')}
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.vectorStoreBackend')}</span>
            <MetricBadge label="" value={activeVdb} color="emerald" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.vectorStoreEmbeddingModel')}</span>
            <MetricBadge label="" value={activeEmbed} color="purple" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.vectorStoreCollection')}</span>
            <span className="text-xs text-foreground font-mono">{t('panels.vectorStoreCollectionValue')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">{t('panels.vectorStoreTotalVectors')}</span>
            <span className="text-xs text-foreground font-mono">
              {embeddings?.total ?? '—'}
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t('panels.vectorStoreDescription')}
        </p>
      </GlassCard>
    </div>
  )
}
