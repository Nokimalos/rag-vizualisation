import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
  MessageSquareText,
} from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePipelineStore } from '../../stores/pipelineStore'
import { useUIStore } from '../../stores/uiStore'
import { cn } from '@/lib/utils'
import type { GlossaryTerm } from '@/content/glossary'
import type { PipelineNodeType, NodeStatus } from '../../types'

// --- Stage definitions (execution order) ---

interface StageDef {
  id: PipelineNodeType
  icon: React.ComponentType<{ className?: string }>
  term?: GlossaryTerm
}

const STAGES: StageDef[] = [
  { id: 'document', icon: FileText },
  { id: 'chunking', icon: Scissors, term: 'chunking' },
  { id: 'embedding', icon: Binary, term: 'embedding' },
  { id: 'vectorStore', icon: Database },
  { id: 'queryInput', icon: MessageCircle },
  { id: 'queryEmbed', icon: Binary, term: 'embedding' },
  { id: 'retrieval', icon: Search, term: 'retrieval' },
  { id: 'ranking', icon: ArrowUpDown },
  { id: 'promptAssembly', icon: Layers },
  { id: 'generation', icon: Sparkles, term: 'generation' },
  { id: 'response', icon: Send },
]

const statusDot: Record<NodeStatus, string> = {
  idle: 'bg-muted-foreground/40',
  processing: 'bg-primary animate-pulse',
  done: 'bg-success',
  error: 'bg-destructive',
}

// --- Progressive client-side reveal ("typewriter") ---
// Always types `text` out smoothly regardless of how bursty the real chunks
// arrive. Eases toward the end so it never lags far behind a long answer.
function useTypewriter(text: string, isRunning: boolean) {
  const [revealed, setRevealed] = useState(0)

  // Reset immediately when the text shrinks (new query → answer becomes '').
  if (revealed > text.length) {
    setRevealed(0)
  }

  useEffect(() => {
    if (revealed >= text.length) return
    const id = window.setInterval(() => {
      setRevealed((prev) => {
        if (prev >= text.length) return prev
        return Math.min(text.length, prev + Math.max(1, Math.ceil((text.length - prev) / 15)))
      })
    }, 25)
    return () => window.clearInterval(id)
  }, [text.length, revealed])

  // While running we may still have text to reveal; treat empty text as done.
  void isRunning
  return { shown: text.slice(0, revealed), done: revealed >= text.length }
}

// --- Connector that sweeps with the SOURCE stage's status ---
function Connector({ status }: { status: NodeStatus }) {
  if (status === 'processing') {
    return (
      <span className="relative h-0.5 w-6 overflow-hidden rounded bg-primary/30">
        <span
          className="absolute inset-y-0 left-0 w-1/2 rounded bg-primary"
          style={{ animation: 'pipeline-connector-sweep 1.1s ease-in-out infinite' }}
        />
      </span>
    )
  }
  const cls =
    status === 'done'
      ? 'bg-primary/50'
      : status === 'error'
        ? 'bg-destructive/40'
        : 'bg-border'
  return <span className={cn('h-0.5 w-6 rounded', cls)} />
}

// --- Minimal inline markdown: render **bold** as <strong> ---
// Splitting on the literal `**` toggles bold on odd segments, so during
// streaming an opened `**` immediately renders bold instead of showing the
// raw asterisks while waiting for the closing `**`.
function renderInlineMarkdown(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

export function PipelineCanvas() {
  const { t } = useTranslation()
  const nodesState = usePipelineStore((s) => s.nodes)
  const answer = usePipelineStore((s) => s.answer)
  const chunks = usePipelineStore((s) => s.chunks)
  const isRunning = usePipelineStore((s) => s.isRunning)
  const setSelectedNode = useUIStore((s) => s.setSelectedNode)
  const selectedNode = useUIStore((s) => s.selectedNode)

  const sortedChunks = [...chunks].sort((a, b) => b.score - a.score)
  const { shown, done } = useTypewriter(answer, isRunning)

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Subtle sweep used by processing connectors (reduced-motion neutralized globally) */}
      <style>{'@keyframes pipeline-connector-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}'}</style>
      <div className="min-h-full flex flex-col justify-center gap-6 max-w-5xl mx-auto px-6 py-8">
        {/* Flow heading + stepper */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {t('pipeline.flowTitle')}
          </h2>

          {/* Horizontal stepper */}
          <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((stage, i) => {
            const status = nodesState[stage.id]?.status ?? 'idle'
            const latencyMs = nodesState[stage.id]?.latencyMs ?? null
            const isSelected = selectedNode === stage.id
            const Icon = stage.icon

            return (
              <Fragment key={stage.id}>
                <button
                  type="button"
                  aria-current={status === 'processing' ? 'step' : undefined}
                  onClick={() => setSelectedNode(stage.id)}
                  title={stage.term ? t(`glossary.${stage.term}`) : undefined}
                  className={cn(
                    'relative w-[116px] rounded-xl border bg-surface p-2.5 text-left transition-all',
                    'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    status === 'processing' ? 'border-primary ring-2 ring-primary/20 animate-pulse' : 'border-border',
                    status === 'idle' && 'opacity-60',
                    isSelected && 'ring-2 ring-primary/40',
                  )}
                >
                  {/* Header row: icon chip + status dot */}
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          status === 'error' ? 'text-destructive' : 'text-foreground',
                        )}
                      />
                    </span>
                    <span className={cn('h-2 w-2 rounded-full', statusDot[status])} />
                  </div>

                  {/* Label */}
                  <div className="mt-2 text-xs font-medium text-foreground leading-tight">
                    {t(`pipelineNodes.${stage.id}`)}
                  </div>

                  {/* Technical term (plain span, no nested button) */}
                  {stage.term && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {stage.term}
                    </div>
                  )}

                  {/* Latency metric */}
                  {latencyMs != null && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {Math.round(latencyMs)} ms
                    </div>
                  )}
                </button>

                {i < STAGES.length - 1 && (
                  <Connector status={status} />
                )}
              </Fragment>
            )
          })}
          </div>
        </div>

        {/* Answer + Sources (always present) */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Answer card */}
          <div className="flex-1 min-h-[200px] bg-surface border border-border rounded-xl p-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('pipeline.answer')}
            </div>
            {answer.length > 0 ? (
              <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {renderInlineMarkdown(shown)}
                {(isRunning || !done) && (
                  <span className="inline-block w-[2px] h-4 bg-primary animate-pulse align-middle" />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 h-full text-center">
                <MessageSquareText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('pipeline.answerEmpty')}</p>
              </div>
            )}
          </div>

          {/* Sources card */}
          <div className="md:w-72 bg-surface border border-border rounded-xl p-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('pipeline.sources')}
            </div>
            {sortedChunks.length > 0 ? (
              <div className="space-y-2.5">
                {sortedChunks.map((chunk, i) => {
                  const pct = Math.max(0, Math.min(1, chunk.score)) * 100
                  return (
                    <div key={chunk.id ?? i}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-foreground">
                          {chunk.id || `#${i + 1}`}
                        </span>
                        <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 bg-muted rounded-full h-1.5 w-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <FileText className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">{t('pipeline.noSources')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
