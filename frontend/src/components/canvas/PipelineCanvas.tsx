import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send, ChevronRight,
} from 'lucide-react'
import { Fragment } from 'react'
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

export function PipelineCanvas() {
  const { t } = useTranslation()
  const nodesState = usePipelineStore((s) => s.nodes)
  const answer = usePipelineStore((s) => s.answer)
  const chunks = usePipelineStore((s) => s.chunks)
  const isRunning = usePipelineStore((s) => s.isRunning)
  const setSelectedNode = useUIStore((s) => s.setSelectedNode)
  const selectedNode = useUIStore((s) => s.selectedNode)

  const hasOutput = answer.length > 0 || chunks.length > 0 || isRunning

  return (
    <div className="w-full h-full overflow-auto bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Section heading */}
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
                    status === 'processing' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
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
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                )}
              </Fragment>
            )
          })}
        </div>

        {/* Answer + Sources */}
        {hasOutput ? (
          <div className="mt-8 flex flex-col gap-4 md:flex-row">
            {/* Answer card */}
            <div className="flex-1 rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('pipeline.answer')}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {answer}
                {isRunning && (
                  <span className="inline-block h-4 w-[2px] bg-primary animate-pulse align-text-bottom" />
                )}
              </div>
            </div>

            {/* Sources card */}
            <div className="w-full md:w-72 rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('pipeline.sources')}
              </div>
              {chunks.length > 0 ? (
                <div className="space-y-2.5">
                  {chunks.map((chunk, i) => {
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
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
                <p className="text-xs text-muted-foreground">{t('pipeline.noSources')}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t('pipeline.idleHint')}
          </p>
        )}
      </div>
    </div>
  )
}
