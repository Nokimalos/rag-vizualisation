import { Loader2, RefreshCw, Box } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEmbeddings } from '../hooks/useEmbeddings'
import { EmbeddingSpace } from '../components/three/EmbeddingSpace'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/common/EmptyState'
import { useUIStore } from '../stores/uiStore'

export function EmbeddingsPage() {
  const { t } = useTranslation()
  const activeCollection = useUIStore((s) => s.activeCollection)
  const { points, loading, error, refresh } = useEmbeddings(activeCollection)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page header / controls bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <Box className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {t('space.title')}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {t('space.subtitle')}
            </p>
          </div>
          {points.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1 tabular-nums">
              {t('space.vectors', { count: points.length })}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="gap-1.5 text-muted-foreground"
          aria-label={t('space.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('space.refresh')}</span>
        </Button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <GlassCard className="max-w-md w-full">
              <p className="text-sm text-destructive font-mono mb-2">{error}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {t('space.errorHint')}
              </p>
            </GlassCard>
          </div>
        )}

        {!loading && !error && points.length === 0 && (
          <EmptyState
            icon={<Box className="w-10 h-10" />}
            title={t('space.emptyTitle')}
            description={t('space.emptyDescription')}
          />
        )}

        {!loading && !error && points.length > 0 && (
          <EmbeddingSpace points={points} className="flex-1" />
        )}
      </div>
    </div>
  )
}
