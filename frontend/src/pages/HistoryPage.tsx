import { useEffect, useState } from 'react'
import { BarChart3, Clock, FileText, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { ScrollArea } from '../components/ui/scroll-area'
import { EmptyState } from '../components/common/EmptyState'
import { api } from '../services/api'
import type { PipelineStats } from '../types'

type Run = { id: string; query: string; status: string; total_latency_ms: number | null; created_at: string }

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

export function HistoryPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getStats(), api.listRuns(20)])
      .then(([s, r]) => {
        setStats(s)
        setRuns(r)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const isEmpty = runs.length === 0

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  function statusLabel(status: string) {
    if (status === 'completed') return t('history.statusCompleted')
    if (status === 'failed') return t('history.statusFailed')
    if (status === 'pending') return t('history.statusPending')
    return status
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t('history.title')}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t('history.subtitle')}</p>
        </div>

        {/* Error banner */}
        {error && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-destructive font-mono">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">{t('history.statsTotal')}</span>
                </div>
                <p className="text-2xl font-mono font-bold text-foreground">
                  {stats.total_runs.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">{t('history.statsLatency')}</span>
                </div>
                <p className="text-2xl font-mono font-bold text-foreground">
                  {stats.avg_latency_ms != null ? `${Math.round(stats.avg_latency_ms)}ms` : '—'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">{t('history.statsDocs')}</span>
                </div>
                <p className="text-2xl font-mono font-bold text-foreground">
                  {stats.total_documents.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Run list */}
        {!loading && !error && isEmpty && (
          <Card>
            <CardContent className="py-2">
              <EmptyState
                icon={<History className="w-8 h-8" />}
                title={t('history.emptyTitle')}
                description={t('history.emptyDescription')}
              />
            </CardContent>
          </Card>
        )}

        {!loading && !isEmpty && (
          <Card>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">{t('history.colQuestion')}</span>
              <span className="text-xs font-medium text-muted-foreground">{t('history.colTime')}</span>
              <span className="text-xs font-medium text-muted-foreground text-right">{t('history.colLatency')}</span>
              <span className="text-xs font-medium text-muted-foreground text-right">{t('history.colStatus')}</span>
            </div>

            <ScrollArea className="max-h-[480px]">
              <ul>
                {runs.map((run, idx) => (
                  <li
                    key={run.id}
                    className={
                      'grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3' +
                      (idx < runs.length - 1 ? ' border-b border-border' : '')
                    }
                  >
                    <p className="text-sm text-foreground truncate" title={run.query}>
                      {run.query}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(run.created_at)}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground text-right whitespace-nowrap">
                      {run.total_latency_ms != null ? `${Math.round(run.total_latency_ms)}ms` : '—'}
                    </span>
                    <Badge variant={statusVariant(run.status)} className="justify-self-end text-xs">
                      {statusLabel(run.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  )
}
