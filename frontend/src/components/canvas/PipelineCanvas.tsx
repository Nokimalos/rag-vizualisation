import {
  FileText, Scissors, Binary, Database, MessageCircle,
  Search, ArrowUpDown, Layers, Sparkles, Send,
} from 'lucide-react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { useUIStore } from '../../stores/uiStore'
import { cn } from '@/lib/utils'
import type { GlossaryTerm } from '@/content/glossary'
import type { PipelineNodeType, NodeStatus } from '../../types'

// --- Node definitions with grid positions (row, col) ---

interface NodeDef {
  id: PipelineNodeType
  label: string
  icon: React.ComponentType<{ className?: string }>
  row: number
  col: number
  term?: GlossaryTerm
}

const NODES: NodeDef[] = [
  // Row 0: Ingestion pipeline
  { id: 'document', label: 'Document', icon: FileText, row: 0, col: 0 },
  { id: 'chunking', label: 'Chunking', icon: Scissors, row: 0, col: 1, term: 'chunking' },
  { id: 'embedding', label: 'Embedding', icon: Binary, row: 0, col: 2, term: 'embedding' },
  { id: 'vectorStore', label: 'Vector Store', icon: Database, row: 0, col: 3 },
  // Row 1: Query pipeline
  { id: 'queryInput', label: 'Query', icon: MessageCircle, row: 1, col: 0 },
  { id: 'queryEmbed', label: 'Query Embed', icon: Binary, row: 1, col: 1, term: 'embedding' },
  // Row 1, col 3: Retrieval (convergence point)
  { id: 'retrieval', label: 'Retrieval', icon: Search, row: 1, col: 3, term: 'retrieval' },
  // Rows 2-5: Generation flow (column 3)
  { id: 'ranking', label: 'Ranking', icon: ArrowUpDown, row: 2, col: 3 },
  { id: 'promptAssembly', label: 'Prompt', icon: Layers, row: 3, col: 3 },
  { id: 'generation', label: 'Generation', icon: Sparkles, row: 4, col: 3, term: 'generation' },
  { id: 'response', label: 'Response', icon: Send, row: 5, col: 3 },
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

const statusDot: Record<NodeStatus, string> = {
  idle: 'bg-muted-foreground/40',
  processing: 'bg-primary animate-pulse',
  done: 'bg-success',
  error: 'bg-destructive',
}

function nodeCenter(row: number, col: number) {
  const x = col * (NODE_W + GAP_X) + NODE_W / 2
  const y = row * (NODE_H + GAP_Y) + NODE_H / 2
  return { x, y }
}

// --- SVG Edge ---
// Stroke colors use the theme palette via CSS variables so edges track light/dark.

const EDGE_COLOR: Record<NodeStatus, string> = {
  idle: 'hsl(var(--border))',
  processing: 'hsl(var(--primary))',
  done: 'hsl(var(--success))',
  error: 'hsl(var(--destructive))',
}

function EdgePath({ from, to, status }: { from: { x: number; y: number }; to: { x: number; y: number }; status: NodeStatus }) {
  const isActive = status === 'processing' || status === 'done'
  const color = EDGE_COLOR[status]

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
        opacity={status === 'idle' ? 0.4 : 0.7}
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
          {/* Soft trail on particles */}
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
    <div className="w-full h-full flex items-center justify-center overflow-auto p-8 bg-background">
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
              type="button"
              aria-current={status === 'processing' ? 'step' : undefined}
              onClick={() => setSelectedNode(node.id)}
              title={node.term}
              className={cn(
                'absolute flex items-center gap-2.5 px-3 rounded-xl border bg-surface text-left transition-all',
                'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                status === 'processing' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                status === 'idle' && 'opacity-60',
                isSelected && 'ring-2 ring-primary/40',
              )}
              style={{ left, top, width: NODE_W, height: NODE_H }}
            >
              {/* Icon box */}
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon
                  className={cn(
                    'h-4.5 w-4.5',
                    status === 'error' ? 'text-destructive' : 'text-foreground',
                  )}
                />
              </span>

              {/* Label + latency */}
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-medium text-foreground leading-tight truncate">
                  {node.label}
                </span>
                {latencyMs != null && (
                  <span className="text-[10px] font-mono text-muted-foreground">{Math.round(latencyMs)} ms</span>
                )}
              </div>

              {/* Status dot */}
              <span className={cn(
                'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background',
                statusDot[status],
              )} />
            </button>
          )
        })}

        {/* Grid dots background */}
        <svg className="absolute inset-0 pointer-events-none -z-10 text-border" width={totalW} height={totalH}>
          <defs>
            <pattern id="grid-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dots)" />
        </svg>
      </div>
    </div>
  )
}
