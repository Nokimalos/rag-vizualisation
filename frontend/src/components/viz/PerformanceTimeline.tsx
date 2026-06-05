import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'

const STEP_LABEL_KEYS: Record<string, string> = {
  query_received: 'viz.timelineStepQuery',
  query_embedded: 'viz.timelineStepEmbedQuery',
  retrieval_done: 'viz.timelineStepRetrieval',
  reranking_done: 'viz.timelineStepReranking',
  prompt_assembled: 'viz.timelineStepPrompt',
  generation_done: 'viz.timelineStepGeneration',
}

const STEP_COLORS: Record<string, string> = {
  query_received: '#4f46e5',
  query_embedded: '#818cf8',
  retrieval_done: '#a5b4fc',
  reranking_done: '#a5b4fc',
  prompt_assembled: '#818cf8',
  generation_done: '#4f46e5',
}

interface StepDatum {
  label: string
  latency: number
  color: string
}

export function PerformanceTimeline() {
  const { t } = useTranslation()
  const events = usePipelineStore((s) => s.events)

  const { steps, totalLatency } = useMemo<{ steps: StepDatum[]; totalLatency: number }>(() => {
    const steps: StepDatum[] = []
    for (const ev of events) {
      const labelKey = STEP_LABEL_KEYS[ev.event]
      if (!labelKey) continue
      const latency = ev.data.latency_ms as number | undefined
      if (latency == null) continue
      steps.push({
        label: t(labelKey),
        latency,
        color: STEP_COLORS[ev.event] ?? '#4f46e5',
      })
    }
    const totalLatency = steps.reduce((sum, s) => sum + s.latency, 0)
    return { steps, totalLatency }
  }, [events, t])

  if (steps.length === 0) return null

  const chartHeight = steps.length * 32 + 20

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          {t('viz.timelineTitle')}
        </h4>
        <MetricBadge label={t('viz.timelineTotal')} value={`${totalLatency}ms`} color="gold" />
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
              cursor={{ fill: 'hsl(var(--accent))' }}
              contentStyle={{
                background: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 11,
                color: 'hsl(var(--foreground))',
              }}
              formatter={(v: number) => [`${v}ms`, t('viz.timelineLatency')]}
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
