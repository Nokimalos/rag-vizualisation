import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'

const STEP_LABELS: Record<string, string> = {
  query_received: 'Query',
  query_embedded: 'Embed Query',
  retrieval_done: 'Retrieval',
  reranking_done: 'Reranking',
  prompt_assembled: 'Prompt',
  generation_done: 'Generation',
}

const STEP_COLORS: Record<string, string> = {
  query_received: '#00d4ff',
  query_embedded: '#8b5cf6',
  retrieval_done: '#10b981',
  reranking_done: '#10b981',
  prompt_assembled: '#8b5cf6',
  generation_done: '#f59e0b',
}

interface StepDatum {
  label: string
  latency: number
  color: string
}

export function PerformanceTimeline() {
  const events = usePipelineStore((s) => s.events)

  const { steps, totalLatency } = useMemo<{ steps: StepDatum[]; totalLatency: number }>(() => {
    const steps: StepDatum[] = []
    for (const ev of events) {
      const label = STEP_LABELS[ev.event]
      if (!label) continue
      const latency = ev.data.latency_ms as number | undefined
      if (latency == null) continue
      steps.push({
        label,
        latency,
        color: STEP_COLORS[ev.event] ?? '#00d4ff',
      })
    }
    const totalLatency = steps.reduce((sum, s) => sum + s.latency, 0)
    return { steps, totalLatency }
  }, [events])

  if (steps.length === 0) return null

  const chartHeight = steps.length * 32 + 20

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
          Performance Timeline
        </h4>
        <MetricBadge label="total" value={`${totalLatency}ms`} color="gold" />
      </div>

      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={steps}
            margin={{ top: 0, right: 48, bottom: 0, left: 80 }}
          >
            <XAxis
              type="number"
              tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v: number) => `${v}ms`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={76}
              tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#12121a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: 11,
              }}
              formatter={(v: number) => [`${v}ms`, 'Latency']}
            />
            <Bar dataKey="latency" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {steps.map((step, i) => (
                <Cell key={i} fill={step.color} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}
