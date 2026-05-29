import { useEffect, useState } from 'react'
import { BarChart3, Clock, FileText } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { api } from '../services/api'
import type { PipelineStats } from '../types'

export function HistoryPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const isEmpty = !stats || stats.total_runs === 0

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-mono font-semibold text-gray-100">History</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">Pipeline run statistics</p>
        </div>

        {error && (
          <GlassCard>
            <p className="text-xs text-red-400 font-mono">{error}</p>
          </GlassCard>
        )}

        {!loading && isEmpty && !error && (
          <GlassCard>
            <div className="flex flex-col items-center gap-3 py-8 text-gray-600">
              <BarChart3 className="w-8 h-8" />
              <span className="text-sm font-mono">No runs yet</span>
              <p className="text-xs text-gray-600 font-mono text-center max-w-xs">
                Run a query on the pipeline page to see statistics here.
              </p>
            </div>
          </GlassCard>
        )}

        {stats && !isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Runs */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-neon-blue/10">
                  <BarChart3 className="w-4 h-4 text-neon-blue" />
                </div>
                <span className="text-xs font-mono text-gray-400">Total Runs</span>
              </div>
              <p className="text-2xl font-mono font-bold text-neon-blue">
                {stats.total_runs.toLocaleString()}
              </p>
            </GlassCard>

            {/* Avg Latency */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-neon-purple/10">
                  <Clock className="w-4 h-4 text-neon-purple" />
                </div>
                <span className="text-xs font-mono text-gray-400">Avg Latency</span>
              </div>
              <p className="text-2xl font-mono font-bold text-neon-purple">
                {stats.avg_latency_ms != null
                  ? `${Math.round(stats.avg_latency_ms)}ms`
                  : '—'}
              </p>
            </GlassCard>

            {/* Documents */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-neon-emerald/10">
                  <FileText className="w-4 h-4 text-neon-emerald" />
                </div>
                <span className="text-xs font-mono text-gray-400">Documents</span>
              </div>
              <p className="text-2xl font-mono font-bold text-neon-emerald">
                {stats.total_documents.toLocaleString()}
              </p>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  )
}
