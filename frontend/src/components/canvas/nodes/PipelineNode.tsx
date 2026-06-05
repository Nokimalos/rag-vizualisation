import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
} from 'lucide-react'
import { usePipelineStore } from '../../../stores/pipelineStore'
import { cn } from '@/lib/utils'
import type { PipelineNodeType, NodeStatus } from '../../../types'

export interface PipelineNodeData {
  nodeId: PipelineNodeType
  label: string
  icon: string
  color: string
  [key: string]: unknown
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
}

const statusDot: Record<NodeStatus, string> = {
  idle: 'bg-muted-foreground/40',
  processing: 'bg-primary animate-pulse',
  done: 'bg-success',
  error: 'bg-destructive',
}

function PipelineNodeComponent({ data }: NodeProps) {
  const nodeData = data as PipelineNodeData
  const { nodeId, label, icon } = nodeData

  const nodeState = usePipelineStore((s) => s.nodes[nodeId])
  const status: NodeStatus = nodeState?.status ?? 'idle'
  const latencyMs = nodeState?.latencyMs ?? null

  const IconComponent = ICON_MAP[icon]

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-1.5 !h-1.5 !bg-border !border-0"
      />

      <div
        className={cn(
          'relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border bg-surface cursor-pointer transition-all select-none',
          'hover:border-primary/40',
          status === 'processing' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          status === 'idle' && 'opacity-60',
        )}
      >
        {/* Icon */}
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          {IconComponent && (
            <IconComponent
              className={cn(
                'h-4 w-4',
                status === 'error' ? 'text-destructive' : 'text-foreground',
              )}
            />
          )}
        </span>

        {/* Label + metrics */}
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-foreground leading-tight whitespace-nowrap">
            {label}
          </span>
          {latencyMs != null && (
            <span className="text-[9px] font-mono text-muted-foreground leading-tight">
              {Math.round(latencyMs)} ms
            </span>
          )}
        </div>

        {/* Status dot */}
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background',
            statusDot[status],
          )}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-border !border-0"
      />
    </>
  )
}

export const PipelineNode = memo(PipelineNodeComponent)
