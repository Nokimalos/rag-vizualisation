import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { ChevronDown, ChevronUp } from 'lucide-react'

function wordSet(text: string): string[] {
  return text.toLowerCase().match(/\b\w{4,}\b/g) ?? []
}

function overlap(a: string, b: string): number {
  const wordsA = new Set(wordSet(a))
  const wordsB = wordSet(b)
  if (wordsA.size === 0 || wordsB.length === 0) return 0
  const shared = wordsB.filter((w) => wordsA.has(w)).length
  const total = wordsA.size + new Set(wordsB).size
  return total === 0 ? 0 : (shared * 2) / total
}

function relevanceBarClass(pct: number): string {
  if (pct >= 0.66) return 'bg-primary'
  if (pct >= 0.33) return 'bg-primary/60'
  return 'bg-primary/40'
}

export function ChunkRelevanceBar() {
  const { t } = useTranslation()
  const chunks = usePipelineStore((s) => s.chunks)
  const answer = usePipelineStore((s) => s.answer)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const tokenWindow = answer.slice(-50)

  const enriched = useMemo(
    () =>
      chunks.map((chunk) => ({
        ...chunk,
        textOverlap: overlap(tokenWindow, chunk.text),
        combined: chunk.score * 0.6 + overlap(tokenWindow, chunk.text) * 0.4,
      })),
    [chunks, tokenWindow],
  )

  if (chunks.length === 0) return null

  return (
    <GlassCard>
      <h4 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {t('relevance.title')}
      </h4>
      <div className="space-y-1">
        {enriched.map((chunk, i) => {
          const pct = Math.max(0, Math.min(1, chunk.combined))
          const isExpanded = expandedIndex === i

          return (
            <div key={chunk.id ?? i}>
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-accent transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="relative flex-shrink-0 w-20 h-2.5 rounded-full overflow-hidden bg-muted">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${relevanceBarClass(pct)}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 w-8 text-right">
                  {(chunk.score * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-foreground font-sans truncate flex-1">
                  {chunk.text.slice(0, 50)}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-1 mr-1 mb-2 p-2.5 rounded-md bg-muted border border-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-primary">
                      {t('relevance.score')}: {(chunk.score * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {t('relevance.overlap')}: {(chunk.textOverlap * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground font-sans leading-relaxed whitespace-pre-wrap">
                    {chunk.text}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
