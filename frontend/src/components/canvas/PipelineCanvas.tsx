import { useRef, useEffect, useState, useCallback } from 'react'
import clsx from 'clsx'
import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
} from 'lucide-react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { useUIStore } from '../../stores/uiStore'
import type { PipelineNodeType, NodeStatus } from '../../types'

// --- Node definitions with grid positions (row, col) ---

interface NodeDef {
  id: PipelineNodeType
  label: string
  icon: React.ComponentType<{ className?: string }>
  row: number
  col: number
  color: string
  glowClass: string
}

const NODES: NodeDef[] = [
  // Row 0: Ingestion pipeline
  { id: 'document', label: 'Document', icon: FileText, row: 0, col: 0, color: '#00d4ff', glowClass: 'glow-blue' },
  { id: 'chunking', label: 'Chunking', icon: Scissors, row: 0, col: 1, color: '#00d4ff', glowClass: 'glow-blue' },
  { id: 'embedding', label: 'Embedding', icon: Binary, row: 0, col: 2, color: '#8b5cf6', glowClass: 'glow-purple' },
  { id: 'vectorStore', label: 'Vector Store', icon: Database, row: 0, col: 3, color: '#8b5cf6', glowClass: 'glow-purple' },
  // Row 1: Query pipeline
  { id: 'queryInput', label: 'Query', icon: MessageCircle, row: 1, col: 0, color: '#10b981', glowClass: 'glow-emerald' },
  { id: 'queryEmbed', label: 'Query Embed', icon: Binary, row: 1, col: 1, color: '#8b5cf6', glowClass: 'glow-purple' },
  // Row 1, col 3: Retrieval (convergence point)
  { id: 'retrieval', label: 'Retrieval', icon: Search, row: 1, col: 3, color: '#10b981', glowClass: 'glow-emerald' },
  // Rows 2-5: Generation flow (column 3)
  { id: 'ranking', label: 'Ranking', icon: ArrowUpDown, row: 2, col: 3, color: '#10b981', glowClass: 'glow-emerald' },
  { id: 'promptAssembly', label: 'Prompt', icon: Layers, row: 3, col: 3, color: '#f59e0b', glowClass: 'glow-gold' },
  { id: 'generation', label: 'Generation', icon: Sparkles, row: 4, col: 3, color: '#f59e0b', glowClass: 'glow-gold' },
  { id: 'response', label: 'Response', icon: Send, row: 5, col: 3, color: '#f59e0b', glowClass: 'glow-gold' },
]

// Edges: [sourceId, targetId]
const EDGES: [PipelineNodeType, PipelineNodeType][] = [
  ['document', 'chunking'],
  ['chunking', 'embedding'],
  ['embedding', 'vectorStore'],
  ['queryInput', 'queryEmbed'],
  ['queryEmbed', 'retrieval'],
  ['vectorStore', 'retrieval'],
  ['retrieval', 'ranking'],
  ['ranking', 'promptAssembly'],
  ['promptAssembly', 'generation'],
  ['generation', 'response'],
]

const NODE_W = 180
const NODE_H = 60
const GAP_X = 80
const GAP_Y = 80
const COLS = 4
const ROWS = 6

const statusBorder: Record<NodeStatus, string> = {
  idle: 'border-white/10',
  processing: 'border-neon-blue/60 ring-1 ring-neon-blue/20',
  done: 'border-white/20',
  error: 'border-red-500/60 ring-1 ring-red-500/20',
}

const statusDot: Record<NodeStatus, string> = {
  idle: 'bg-gray-600',
  processing: 'bg-neon-blue animate-pulse',
  done: 'bg-neon-emerald',
  error: 'bg-red-500',
}

function nodeCenter(row: number, col: number) {
  const x = col * (NODE_W + GAP_X) + NODE_W / 2
  const y = row * (NODE_H + GAP_Y) + NODE_H / 2
  return { x, y }
}

// --- SVG Edge ---

function EdgePath({ from, to, status }: { from: { x: number; y: number }; to: { x: number; y: number }; status: NodeStatus }) {
  const isActive = status === 'processing' || status === 'done'
  const color = status === 'error' ? '#ef4444' : status === 'processing' ? '#00d4ff' : status === 'done' ? '#10b981' : '#374151'

  // Decide path type
  const dx = to.x - from.x
  const dy = to.y - from.y

  let d: string
  if (Math.abs(dy) < 5) {
    // Horizontal: straight line
    d = `M${from.x} ${from.y} L${to.x} ${to.y}`
  } else if (Math.abs(dx) < 5) {
    // Vertical: straight line
    d = `M${from.x} ${from.y} L${to.x} ${to.y}`
  } else {
    // L-shaped: go horizontal then vertical (or vice versa)
    const midX = from.x + dx
    d = `M${from.x} ${from.y} L${midX} ${from.y} L${to.x} ${to.y}`
  }

  return (
    <g>
      {/* Base path */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2 : 1}
        opacity={status === 'idle' ? 0.25 : 0.6}
        strokeLinejoin="round"
      />
      {/* Animated particle dots */}
      {isActive && (
        <>
          {[0, 0.33, 0.66].map((offset) => (
            <circle key={offset} r={2.5} fill={color} opacity={0.9}>
              <animateMotion dur="2s" repeatCount="indefinite" begin={`${offset * 2}s`} path={d} />
            </circle>
          ))}
          {/* Glow on particles */}
          {[0, 0.33, 0.66].map((offset) => (
            <circle key={`g${offset}`} r={5} fill={color} opacity={0.2}>
              <animateMotion dur="2s" repeatCount="indefinite" begin={`${offset * 2}s`} path={d} />
            </circle>
          ))}
        </>
      )}
    </g>
  )
}

// --- Main Canvas ---

export function PipelineCanvas() {
  const nodesState = usePipelineStore((s) => s.nodes)
  const setSelectedNode = useUIStore((s) => s.setSelectedNode)
  const selectedNode = useUIStore((s) => s.selectedNode)

  const totalW = COLS * (NODE_W + GAP_X) - GAP_X
  const totalH = ROWS * (NODE_H + GAP_Y) - GAP_Y

  // Build edge data with source node positions
  const nodeMap = new Map<PipelineNodeType, NodeDef>()
  for (const n of NODES) nodeMap.set(n.id, n)

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
      <div className="relative" style={{ width: totalW, height: totalH }}>
        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={totalW}
          height={totalH}
          style={{ overflow: 'visible' }}
        >
          {EDGES.map(([srcId, tgtId]) => {
            const src = nodeMap.get(srcId)!
            const tgt = nodeMap.get(tgtId)!
            const from = nodeCenter(src.row, src.col)
            const to = nodeCenter(tgt.row, tgt.col)
            const srcStatus = nodesState[srcId]?.status ?? 'idle'

            // Offset start/end to edge of node
            const fromX = from.x + (to.x > from.x ? NODE_W / 2 : to.x < from.x ? -NODE_W / 2 : 0)
            const fromY = from.y + (to.y > from.y && Math.abs(to.x - from.x) < NODE_W ? NODE_H / 2 : 0)
            const toX = to.x + (from.x < to.x ? -NODE_W / 2 : from.x > to.x ? NODE_W / 2 : 0)
            const toY = to.y + (from.y < to.y && Math.abs(to.x - from.x) < NODE_W ? -NODE_H / 2 : 0)

            return (
              <EdgePath
                key={`${srcId}-${tgtId}`}
                from={{ x: fromX, y: fromY }}
                to={{ x: toX, y: toY }}
                status={srcStatus}
              />
            )
          })}
        </svg>

        {/* Node layer */}
        {NODES.map((node) => {
          const status = nodesState[node.id]?.status ?? 'idle'
          const latencyMs = nodesState[node.id]?.latencyMs ?? null
          const isSelected = selectedNode === node.id
          const Icon = node.icon

          const left = node.col * (NODE_W + GAP_X)
          const top = node.row * (NODE_H + GAP_Y)

          return (
            <button
              key={node.id}
              onClick={() => setSelectedNode(node.id)}
              className={clsx(
                'absolute flex items-center gap-2.5 px-3 rounded-lg border transition-all duration-300',
                'bg-bg-secondary/90 backdrop-blur-sm hover:bg-bg-tertiary/90',
                statusBorder[status],
                status === 'done' && node.glowClass,
                isSelected && 'ring-2 ring-white/20',
              )}
              style={{ left, top, width: NODE_W, height: NODE_H }}
            >
              {/* Icon box */}
              <div className={clsx(
                'flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0',
                status === 'done' ? 'bg-white/10' : 'bg-white/5',
              )}>
                <Icon
                  className={clsx(
                    'w-4.5 h-4.5 transition-colors duration-300',
                    status === 'idle' && 'text-gray-500',
                    status === 'error' && 'text-red-400',
                  )}
                  {...(status !== 'idle' && status !== 'error' ? { style: { color: node.color } } : {})}
                />
              </div>

              {/* Label + latency */}
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-medium text-gray-200 leading-tight truncate">
                  {node.label}
                </span>
                {latencyMs != null && (
                  <span className="text-[10px] font-mono text-gray-500">{Math.round(latencyMs)}ms</span>
                )}
              </div>

              {/* Status dot */}
              <span className={clsx(
                'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-primary',
                statusDot[status],
              )} />
            </button>
          )
        })}

        {/* Grid dots background */}
        <svg className="absolute inset-0 pointer-events-none -z-10" width={totalW} height={totalH}>
          <defs>
            <pattern id="grid-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="#1a1a2e" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dots)" />
        </svg>
      </div>
    </div>
  )
}
