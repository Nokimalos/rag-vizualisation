import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TermTooltip } from '@/components/common/TermTooltip'
import type { GlossaryTerm } from '@/content/glossary'
import type { NodeStatus } from '@/types'

const DOT: Record<NodeStatus, string> = {
  idle: 'bg-muted-foreground/40',
  processing: 'bg-primary animate-pulse',
  done: 'bg-success',
  error: 'bg-destructive',
}

interface StageCardProps {
  icon: LucideIcon
  label: string
  term?: GlossaryTerm
  status: NodeStatus
  metric?: string
  onClick?: () => void
}

export function StageCard({ icon: Icon, label, term, status, metric, onClick }: StageCardProps) {
  return (
    <button
      type="button"
      role="listitem"
      aria-current={status === 'processing' ? 'step' : undefined}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border bg-surface p-3 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        status === 'processing' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        status === 'idle' && 'opacity-60',
        onClick && 'hover:border-primary/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground" />
        </span>
        <span className={cn('h-2 w-2 rounded-full', DOT[status])} />
      </div>
      {term ? (
        <TermTooltip term={term} label={label} />
      ) : (
        <div className="text-sm font-medium">{label}</div>
      )}
      {metric && <div className="font-mono text-[11px] text-muted-foreground">{metric}</div>}
    </button>
  )
}
