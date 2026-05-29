import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
} from 'lucide-react'
import { usePipelineStore } from '../../../stores/pipelineStore'
import type { PipelineNodeType, NodeStatus } from '../../../types'

export interface PipelineNodeData {
  nodeId: PipelineNodeType
  label: string
  icon: string
  color: string
  glowClass: string
  [key: string]: unknown
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
}

const statusStyles: Record<NodeStatus, { border: string; dot: string; ring: string }> = {
  idle: {
    border: 'border-white/10',
    dot: 'bg-gray-600',
    ring: '',
  },
  processing: {
    border: 'border-neon-blue/60',
    dot: 'bg-neon-blue animate-pulse',
    ring: 'ring-1 ring-neon-blue/20',
  },
  done: {
    border: 'border-neon-emerald/50',
    dot: 'bg-neon-emerald',
    ring: '',
  },
  error: {
    border: 'border-red-500/60',
    dot: 'bg-red-500',
    ring: 'ring-1 ring-red-500/20',
  },
}

function PipelineNodeComponent({ data }: NodeProps) {
  const nodeData = data as PipelineNodeData
  const { nodeId, label, icon, color, glowClass } = nodeData

  const nodeState = usePipelineStore((s) => s.nodes[nodeId])
  const status: NodeStatus = nodeState?.status ?? 'idle'
  const latencyMs = nodeState?.latencyMs ?? null
  const styles = statusStyles[status]

  const IconComponent = ICON_MAP[icon]

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-1.5 !h-1.5 !bg-white/20 !border-0"
      />

      <div
        className={clsx(
          'relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all duration-300 select-none',
          'bg-bg-secondary/90 backdrop-blur-sm hover:bg-bg-tertiary/90',
          styles.border,
          styles.ring,
          status === 'done' && glowClass,
        )}
      >
        {/* Icon */}
        <div
          className={clsx(
            'flex items-center justify-center w-8 h-8 rounded-md',
            status === 'done' ? 'bg-white/10' : 'bg-white/5',
          )}
        >
          {IconComponent && (
            <IconComponent
              className={clsx(
                'w-4 h-4 transition-colors duration-300',
                status === 'idle' && 'text-gray-500',
                status === 'error' && 'text-red-400',
              )}
              {...(status !== 'idle' && status !== 'error' ? { style: { color } } : {})}
            />
          )}
        </div>

        {/* Label + metrics */}
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-gray-200 leading-tight whitespace-nowrap">
            {label}
          </span>
          {latencyMs != null && (
            <span className="text-[9px] font-mono text-gray-500 leading-tight">
              {Math.round(latencyMs)}ms
            </span>
          )}
        </div>

        {/* Status dot */}
        <span
          className={clsx(
            'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-primary',
            styles.dot,
          )}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-white/20 !border-0"
      />
    </>
  )
}

export const PipelineNode = memo(PipelineNodeComponent)
