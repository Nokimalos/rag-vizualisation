import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { NodeStatus } from '../../../types'

type EdgeStatus = NodeStatus

const STATUS_COLORS: Record<EdgeStatus, string> = {
  idle: '#374151',
  processing: '#00d4ff',
  done: '#10b981',
  error: '#ef4444',
}

interface ParticleEdgeData extends Record<string, unknown> {
  status?: EdgeStatus
  particleCount?: number
}

function ParticleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = (data ?? {}) as ParticleEdgeData
  const status: EdgeStatus = edgeData.status ?? 'idle'
  const particleCount: number = edgeData.particleCount ?? 3
  const color = STATUS_COLORS[status]
  const isAnimated = status === 'processing' || status === 'done'

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const filterId = `particle-glow-${id}`
  const particles = Array.from({ length: particleCount }, (_, i) => i)

  return (
    <>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          opacity: isAnimated ? 1 : 0.6,
        }}
      />

      {isAnimated &&
        particles.map((i) => {
          const duration = status === 'processing' ? 1.6 : 2.4
          const delay = (i / particleCount) * duration

          return (
            <circle
              key={i}
              r={3}
              fill={color}
              filter={`url(#${filterId})`}
              opacity={0.9}
            >
              <animateMotion
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
                path={edgePath}
              />
            </circle>
          )
        })}
    </>
  )
}

export const ParticleEdge = memo(ParticleEdgeComponent)
