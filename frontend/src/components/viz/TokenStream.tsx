import { useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

interface SparkPoint { t: number; rate: number }

function renderMarkdown(text: string) {
  // Split by **...** patterns and alternate between normal and bold
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-white font-semibold">{part}</strong>
      : <span key={i}>{part}</span>
  )
}

export function TokenStream() {
  const tokens = usePipelineStore((s) => s.tokens)
  const answer = usePipelineStore((s) => s.answer)
  const events = usePipelineStore((s) => s.events)
  const isRunning = usePipelineStore((s) => s.isRunning)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new tokens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [tokens.length])

  // Compute sparkline: bucket token_generated events by 500ms intervals
  const { sparkData, currentRate } = useMemo<{ sparkData: SparkPoint[]; currentRate: number }>(() => {
    const tokenEvents = events.filter((e) => e.event === 'token_generated')
    if (tokenEvents.length === 0) return { sparkData: [], currentRate: 0 }

    const firstTs = new Date(tokenEvents[0].timestamp).getTime()
    const buckets = new Map<number, number>()

    for (const ev of tokenEvents) {
      const ms = new Date(ev.timestamp).getTime() - firstTs
      const bucket = Math.floor(ms / 500)
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }

    const maxBucket = Math.max(...buckets.keys())
    const sparkData: SparkPoint[] = []
    for (let b = 0; b <= maxBucket; b++) {
      const count = buckets.get(b) ?? 0
      sparkData.push({ t: b, rate: (count / 500) * 1000 })
    }

    const last = sparkData[sparkData.length - 1]
    return { sparkData, currentRate: last ? Math.round(last.rate) : 0 }
  }, [events])

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
          Token Stream
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-neon-gold font-mono">{currentRate}</span>
          <span className="text-xs text-gray-400 font-mono">Tokens/sec</span>
        </div>
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div className="mb-3" style={{ height: 40 }}>
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }}
                formatter={(v: number) => [`${Math.round(v)} tok/s`, 'Rate']}
                labelFormatter={() => ''}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Token display */}
      <div
        ref={scrollRef}
        className="font-mono text-sm leading-relaxed overflow-y-auto"
        style={{ maxHeight: 300 }}
      >
        {tokens.length === 0 ? (
          <span className="text-gray-500 text-xs">Waiting for tokens…</span>
        ) : (
          <>
            <span className="text-gray-200">{renderMarkdown(answer)}</span>
            {isRunning && (
              <span className="inline-block w-0.5 h-4 bg-neon-gold ml-0.5 animate-pulse align-text-bottom" />
            )}
          </>
        )}
      </div>
    </GlassCard>
  )
}
