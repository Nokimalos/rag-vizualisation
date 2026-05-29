# Spectacular Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 5 spectacular visualization components to the RAG pipeline frontend: 3D Embedding Space Explorer, Particle Flow Engine on edges, Token Stream Visualizer with chunk relevance heatmap, Chunk Similarity Matrix (D3 heatmap), and Pipeline Performance Timeline.

**Architecture:** Each visualization is a self-contained React component that reads from the existing Zustand pipelineStore and API client. Three.js scenes use React Three Fiber for declarative 3D. D3 is used for the heatmap via a headless approach (D3 computes, React renders). Recharts handles the timeline. All visualizations plug into existing panels or routes.

**Tech Stack:** React Three Fiber 8+, @react-three/drei 9+, @react-three/postprocessing 2+, D3.js 7+, Recharts 2+ (already installed)

---

## File Structure

```
frontend/src/
├── components/
│   ├── three/                              # 3D visualization components
│   │   ├── EmbeddingSpace.tsx              # 3D point cloud scene (R3F)
│   │   ├── ChunkPoint.tsx                  # Individual chunk point with hover
│   │   ├── QuerySphere.tsx                 # Query vector luminous sphere + laser lines
│   │   └── effects/
│   │       └── SceneEffects.tsx            # Bloom/glow postprocessing
│   ├── canvas/
│   │   └── edges/
│   │       └── ParticleEdge.tsx            # Custom React Flow edge with particles
│   ├── viz/                                # 2D visualization components
│   │   ├── TokenStream.tsx                 # Typewriter tokens + sparkline
│   │   ├── ChunkRelevanceBar.tsx           # Lateral heatmap for chunk relevance
│   │   ├── SimilarityMatrix.tsx            # D3 heatmap for chunk similarity
│   │   └── PerformanceTimeline.tsx         # Gantt-like timeline (Recharts)
│   └── panels/                             # Updated panels
│       ├── EmbeddingPanel.tsx              # Updated: embed 3D mini-view
│       └── GenerationPanel.tsx             # Updated: use TokenStream
├── pages/
│   └── EmbeddingsPage.tsx                  # Full-screen 3D embedding explorer
├── hooks/
│   └── useEmbeddings.ts                    # Fetch + cache 3D embedding data
└── types/
    └── index.ts                            # Add similarity matrix types
```

---

## Task 1: Install Three.js Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Three.js ecosystem**

```bash
cd frontend
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install -D @types/three
```

- [ ] **Step 2: Install D3**

```bash
cd frontend
npm install d3
npm install -D @types/d3
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: no errors.

---

## Task 2: Embedding Space Explorer — 3D Point Cloud

**Files:**
- Create: `frontend/src/hooks/useEmbeddings.ts`
- Create: `frontend/src/components/three/ChunkPoint.tsx`
- Create: `frontend/src/components/three/effects/SceneEffects.tsx`
- Create: `frontend/src/components/three/EmbeddingSpace.tsx`

- [ ] **Step 1: Create useEmbeddings hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { EmbeddingPoint } from '../types'

interface UseEmbeddingsResult {
  points: EmbeddingPoint[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useEmbeddings(collection = 'default'): UseEmbeddingsResult {
  const [points, setPoints] = useState<EmbeddingPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getEmbeddings3D(collection)
      setPoints(data.points)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [collection])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { points, loading, error, refresh }
}
```

- [ ] **Step 2: Create ChunkPoint component**

A single point in the 3D space. Sphere with color based on document, hover tooltip.

```tsx
import { useState, useRef } from 'react'
import { Html } from '@react-three/drei'
import type { Mesh } from 'three'
import type { EmbeddingPoint } from '../../types'

interface ChunkPointProps {
  point: EmbeddingPoint
  color: string
  isHighlighted: boolean
  onHover: (point: EmbeddingPoint | null) => void
}

export function ChunkPoint({ point, color, isHighlighted, onHover }: ChunkPointProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const scale = isHighlighted ? 1.5 : hovered ? 1.3 : 1

  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh
        ref={meshRef}
        scale={scale}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(point) }}
        onPointerOut={() => { setHovered(false); onHover(null) }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHighlighted ? 0.8 : hovered ? 0.5 : 0.2}
          transparent
          opacity={isHighlighted ? 1 : 0.85}
        />
      </mesh>

      {hovered && (
        <Html distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="glass rounded-lg px-3 py-2 max-w-[200px] text-xs">
            <p className="text-white font-mono truncate">{point.id}</p>
            <p className="text-gray-400 line-clamp-3 mt-1">{point.text}</p>
          </div>
        </Html>
      )}
    </group>
  )
}
```

- [ ] **Step 3: Create SceneEffects**

```tsx
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export function SceneEffects() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        intensity={0.6}
        mipmapBlur
      />
    </EffectComposer>
  )
}
```

- [ ] **Step 4: Create EmbeddingSpace main component**

The main 3D scene with point cloud, orbit controls, ambient light, and bloom effects.

```tsx
import { useMemo, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { ChunkPoint } from './ChunkPoint'
import { SceneEffects } from './effects/SceneEffects'
import type { EmbeddingPoint } from '../../types'

// Generate a stable color per document_id
const DOC_COLORS = ['#00d4ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']
function getDocColor(docId: string, docColorMap: Map<string, string>): string {
  if (!docColorMap.has(docId)) {
    docColorMap.set(docId, DOC_COLORS[docColorMap.size % DOC_COLORS.length])
  }
  return docColorMap.get(docId)!
}

interface EmbeddingSpaceProps {
  points: EmbeddingPoint[]
  queryPoint?: { x: number; y: number; z: number } | null
  nearestIds?: string[]
  className?: string
}

export function EmbeddingSpace({ points, queryPoint, nearestIds, className }: EmbeddingSpaceProps) {
  const [hoveredPoint, setHoveredPoint] = useState<EmbeddingPoint | null>(null)

  const docColorMap = useMemo(() => new Map<string, string>(), [])

  const highlightedIds = useMemo(() => new Set(nearestIds ?? []), [nearestIds])

  const handleHover = useCallback((point: EmbeddingPoint | null) => {
    setHoveredPoint(point)
  }, [])

  return (
    <div className={className ?? 'w-full h-full'}>
      <Canvas camera={{ position: [5, 5, 5], fov: 60 }} gl={{ antialias: true }}>
        <color attach="background" args={['#0a0a0f']} />
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />

        {/* Point cloud */}
        {points.map((point) => {
          const docId = (point.metadata.document_id as string) ?? 'unknown'
          return (
            <ChunkPoint
              key={point.id}
              point={point}
              color={getDocColor(docId, docColorMap)}
              isHighlighted={highlightedIds.has(point.id)}
              onHover={handleHover}
            />
          )
        })}

        {/* Query sphere */}
        {queryPoint && (
          <mesh position={[queryPoint.x, queryPoint.y, queryPoint.z]}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#f59e0b"
              emissiveIntensity={1.2}
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

        {/* Laser lines from query to nearest chunks */}
        {queryPoint && nearestIds && points
          .filter((p) => highlightedIds.has(p.id))
          .map((p) => (
            <line key={`laser-${p.id}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([queryPoint.x, queryPoint.y, queryPoint.z, p.x, p.y, p.z])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#f59e0b" transparent opacity={0.4} linewidth={1} />
            </line>
          ))}

        <OrbitControls enableDamping dampingFactor={0.05} />
        <Stars radius={50} depth={50} count={500} factor={2} saturation={0} />
        <SceneEffects />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 3: Particle Flow Edge

**Files:**
- Create: `frontend/src/components/canvas/edges/ParticleEdge.tsx`
- Modify: `frontend/src/components/canvas/PipelineCanvas.tsx`

- [ ] **Step 1: Create ParticleEdge**

Custom React Flow edge that draws animated dots flowing along the path.

```tsx
import { memo, useMemo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

interface ParticleEdgeData {
  status: string
  particleCount: number
  color: string
}

const STAGE_COLORS: Record<string, string> = {
  idle: '#374151',
  processing: '#00d4ff',
  done: '#10b981',
  error: '#ef4444',
}

export const ParticleEdge = memo(function ParticleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as ParticleEdgeData | undefined
  const status = edgeData?.status ?? 'idle'
  const color = STAGE_COLORS[status] ?? '#374151'
  const isAnimated = status === 'processing' || status === 'done'
  const particleCount = edgeData?.particleCount ?? 3

  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  // Generate particle offsets evenly spaced
  const particles = useMemo(() => {
    if (!isAnimated) return []
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      delay: (i / particleCount) * 2, // stagger over 2s animation cycle
    }))
  }, [isAnimated, particleCount])

  return (
    <>
      {/* Base edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: status === 'done' ? 2 : 1.5,
          opacity: status === 'idle' ? 0.3 : 0.7,
        }}
      />

      {/* Animated particles */}
      {particles.map((p) => (
        <circle key={p.id} r={3} fill={color} filter="url(#glow)">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            begin={`${p.delay}s`}
            path={edgePath}
          />
        </circle>
      ))}

      {/* SVG glow filter (defined once, shared) */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </>
  )
})
```

- [ ] **Step 2: Update PipelineCanvas to use ParticleEdge**

Modify `frontend/src/components/canvas/PipelineCanvas.tsx`:

Add import:
```typescript
import { ParticleEdge } from './edges/ParticleEdge'
```

Update `nodeTypes` to also register edge types:
```typescript
const edgeTypes = { particle: ParticleEdge }
```

Update edge generation in `rfEdges` to use `type: 'particle'` and pass status data:
```typescript
const rfEdges: Edge[] = useMemo(
  () =>
    PIPELINE_EDGES.map((edge) => {
      const sourceStatus: NodeStatus = nodesState[edge.source as keyof typeof nodesState]?.status ?? 'idle'
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'particle',
        data: {
          status: sourceStatus,
          particleCount: sourceStatus === 'processing' ? 5 : 3,
          color: edgeColorByStatus[sourceStatus],
        },
      }
    }),
  [nodesState],
)
```

Add `edgeTypes` to `ReactFlow`:
```tsx
<ReactFlow
  nodes={rfNodes}
  edges={rfEdges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  ...
>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 4: Token Stream Visualizer

**Files:**
- Create: `frontend/src/components/viz/TokenStream.tsx`
- Create: `frontend/src/components/viz/ChunkRelevanceBar.tsx`

- [ ] **Step 1: Create TokenStream component**

Typewriter effect with glow on new tokens + tokens/sec sparkline.

```tsx
import { useRef, useEffect, useMemo } from 'react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export function TokenStream() {
  const tokens = usePipelineStore((s) => s.tokens)
  const events = usePipelineStore((s) => s.events)
  const isRunning = usePipelineStore((s) => s.isRunning)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [tokens.length])

  // Compute tokens/sec sparkline data from token timestamps
  const sparklineData = useMemo(() => {
    const tokenEvents = events.filter((e) => e.event === 'token_generated')
    if (tokenEvents.length < 2) return []

    const bucketSize = 500 // 500ms buckets
    const data: { t: number; rate: number }[] = []
    let bucketStart = Date.parse(tokenEvents[0].timestamp)
    let count = 0

    for (const ev of tokenEvents) {
      const t = Date.parse(ev.timestamp)
      if (t - bucketStart > bucketSize) {
        data.push({ t: bucketStart, rate: (count / bucketSize) * 1000 })
        bucketStart = t
        count = 0
      }
      count++
    }
    if (count > 0) {
      data.push({ t: bucketStart, rate: (count / bucketSize) * 1000 })
    }
    return data
  }, [events])

  const currentRate = sparklineData.length > 0
    ? sparklineData[sparklineData.length - 1].rate.toFixed(1)
    : '0'

  return (
    <div className="space-y-3">
      {/* Tokens/sec sparkline */}
      <GlassCard>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-gray-500">Tokens/sec</span>
          <span className="text-sm font-mono text-neon-gold font-bold">{currentRate}</span>
        </div>
        {sparklineData.length > 1 && (
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Token stream with typewriter effect */}
      <GlassCard padding={false}>
        <div
          ref={containerRef}
          className="p-3 max-h-[300px] overflow-y-auto text-sm font-sans leading-relaxed"
        >
          {tokens.map((token, i) => (
            <span
              key={i}
              className={
                i === tokens.length - 1 && isRunning
                  ? 'text-neon-gold animate-pulse'
                  : 'text-gray-200'
              }
            >
              {token}
            </span>
          ))}
          {isRunning && (
            <span className="inline-block w-0.5 h-4 bg-neon-gold ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Create ChunkRelevanceBar**

Lateral heatmap showing which chunks are most related to recent tokens (approximated via word overlap).

```tsx
import { useMemo } from 'react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

function computeOverlap(tokenWindow: string, chunkText: string): number {
  const tokenWords = new Set(tokenWindow.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const chunkWords = new Set(chunkText.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  if (tokenWords.size === 0 || chunkWords.size === 0) return 0
  let overlap = 0
  for (const word of tokenWords) {
    if (chunkWords.has(word)) overlap++
  }
  return overlap / Math.max(tokenWords.size, 1)
}

export function ChunkRelevanceBar() {
  const chunks = usePipelineStore((s) => s.chunks)
  const answer = usePipelineStore((s) => s.answer)

  // Use last 50 chars as the "token window" for overlap computation
  const tokenWindow = answer.slice(-50)

  const relevanceScores = useMemo(() => {
    if (!tokenWindow || chunks.length === 0) return []
    return chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text.slice(0, 60),
      score: computeOverlap(tokenWindow, chunk.text),
    }))
  }, [tokenWindow, chunks])

  if (relevanceScores.length === 0) return null

  return (
    <GlassCard>
      <h4 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
        Chunk Relevance
      </h4>
      <div className="space-y-1.5">
        {relevanceScores.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-600 w-4">{i + 1}</span>
            <div className="flex-1 h-3 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(item.score * 100, 5)}%`,
                  background: `linear-gradient(90deg, #8b5cf6, #f59e0b)`,
                  opacity: 0.3 + item.score * 0.7,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-600 truncate max-w-[80px]">
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 5: Chunk Similarity Matrix

**Files:**
- Create: `frontend/src/components/viz/SimilarityMatrix.tsx`

- [ ] **Step 1: Add similarity types**

Add to `frontend/src/types/index.ts`:

```typescript
export interface SimilarityCell {
  row: number
  col: number
  score: number
  rowLabel: string
  colLabel: string
}
```

- [ ] **Step 2: Create SimilarityMatrix component**

D3 computes layout, React renders SVG. Interactive heatmap with hover and click.

```tsx
import { useMemo, useState } from 'react'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import type { SimilarityCell } from '../../types'
import * as d3 from 'd3'

function computeCosineSimilarity(a: string, b: string): number {
  // Word-level TF approximation for visualization purposes
  const wordsA = a.toLowerCase().split(/\s+/)
  const wordsB = b.toLowerCase().split(/\s+/)
  const vocab = new Set([...wordsA, ...wordsB])
  const vecA = Array.from(vocab, (w) => wordsA.filter((x) => x === w).length)
  const vecB = Array.from(vocab, (w) => wordsB.filter((x) => x === w).length)
  const dot = vecA.reduce((s, v, i) => s + v * vecB[i], 0)
  const magA = Math.sqrt(vecA.reduce((s, v) => s + v * v, 0))
  const magB = Math.sqrt(vecB.reduce((s, v) => s + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

export function SimilarityMatrix() {
  const chunks = usePipelineStore((s) => s.chunks)
  const [selectedCell, setSelectedCell] = useState<SimilarityCell | null>(null)

  const matrix = useMemo<SimilarityCell[]>(() => {
    if (chunks.length < 2) return []
    const cells: SimilarityCell[] = []
    for (let i = 0; i < chunks.length; i++) {
      for (let j = 0; j < chunks.length; j++) {
        cells.push({
          row: i,
          col: j,
          score: i === j ? 1 : computeCosineSimilarity(chunks[i].text, chunks[j].text),
          rowLabel: `C${i + 1}`,
          colLabel: `C${j + 1}`,
        })
      }
    }
    return cells
  }, [chunks])

  const colorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain([0, 1]),
    [],
  )

  if (chunks.length < 2) return null

  const n = chunks.length
  const cellSize = Math.min(40, 200 / n)
  const margin = { top: 30, left: 30 }
  const size = n * cellSize

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
          Chunk Similarity Matrix
        </h4>
        <div className="overflow-auto">
          <svg width={size + margin.left + 10} height={size + margin.top + 10}>
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Column labels */}
              {Array.from({ length: n }, (_, i) => (
                <text
                  key={`col-${i}`}
                  x={i * cellSize + cellSize / 2}
                  y={-8}
                  textAnchor="middle"
                  className="fill-gray-500 text-[10px] font-mono"
                >
                  C{i + 1}
                </text>
              ))}
              {/* Row labels */}
              {Array.from({ length: n }, (_, i) => (
                <text
                  key={`row-${i}`}
                  x={-8}
                  y={i * cellSize + cellSize / 2 + 3}
                  textAnchor="end"
                  className="fill-gray-500 text-[10px] font-mono"
                >
                  C{i + 1}
                </text>
              ))}
              {/* Cells */}
              {matrix.map((cell) => (
                <rect
                  key={`${cell.row}-${cell.col}`}
                  x={cell.col * cellSize}
                  y={cell.row * cellSize}
                  width={cellSize - 1}
                  height={cellSize - 1}
                  rx={2}
                  fill={colorScale(cell.score)}
                  opacity={selectedCell && (selectedCell.row === cell.row || selectedCell.col === cell.col) ? 1 : 0.85}
                  stroke={selectedCell?.row === cell.row && selectedCell?.col === cell.col ? '#ffffff' : 'none'}
                  strokeWidth={2}
                  className="cursor-pointer transition-opacity"
                  onClick={() => setSelectedCell(cell)}
                >
                  <title>{`${cell.rowLabel} × ${cell.colLabel}: ${(cell.score * 100).toFixed(0)}%`}</title>
                </rect>
              ))}
            </g>
          </svg>
        </div>
      </GlassCard>

      {/* Selected cell detail */}
      {selectedCell && selectedCell.row !== selectedCell.col && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-neon-purple">
              C{selectedCell.row + 1} × C{selectedCell.col + 1}
            </span>
            <span className="text-xs font-mono text-gray-500">
              {(selectedCell.score * 100).toFixed(0)}% similar
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-[11px] text-gray-300 leading-relaxed line-clamp-4 bg-bg-tertiary rounded-lg p-2">
              {chunks[selectedCell.row]?.text}
            </div>
            <div className="text-[11px] text-gray-300 leading-relaxed line-clamp-4 bg-bg-tertiary rounded-lg p-2">
              {chunks[selectedCell.col]?.text}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 6: Pipeline Performance Timeline

**Files:**
- Create: `frontend/src/components/viz/PerformanceTimeline.tsx`

- [ ] **Step 1: Create PerformanceTimeline**

Horizontal Gantt-like bars using Recharts BarChart.

```tsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

const STEP_COLORS: Record<string, string> = {
  query_received: '#00d4ff',
  query_embedded: '#8b5cf6',
  retrieval_done: '#10b981',
  reranking_done: '#10b981',
  prompt_assembled: '#f59e0b',
  generation_done: '#f59e0b',
  pipeline_complete: '#00d4ff',
}

const STEP_LABELS: Record<string, string> = {
  query_received: 'Query',
  query_embedded: 'Embed Query',
  retrieval_done: 'Retrieval',
  reranking_done: 'Reranking',
  prompt_assembled: 'Prompt',
  generation_done: 'Generation',
}

export function PerformanceTimeline() {
  const events = usePipelineStore((s) => s.events)

  const timelineData = useMemo(() => {
    const steps = events.filter(
      (e) => e.data.latency_ms != null && STEP_LABELS[e.event],
    )
    return steps.map((e) => ({
      name: STEP_LABELS[e.event] ?? e.event,
      latency: Math.round(e.data.latency_ms as number),
      event: e.event,
    }))
  }, [events])

  if (timelineData.length === 0) return null

  const totalLatency = timelineData.reduce((s, d) => s + d.latency, 0)

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Performance Timeline
        </h4>
        <span className="text-xs font-mono text-neon-blue">{totalLatency}ms total</span>
      </div>

      <ResponsiveContainer width="100%" height={timelineData.length * 32 + 20}>
        <BarChart data={timelineData} layout="vertical" margin={{ left: 70, right: 40, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} unit="ms" />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={65}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#ffffff', fontSize: 12 }}
            itemStyle={{ color: '#9ca3af', fontSize: 11 }}
            formatter={(value: number) => [`${value}ms`, 'Latency']}
          />
          <Bar dataKey="latency" radius={[0, 4, 4, 0]} barSize={20}>
            {timelineData.map((entry) => (
              <Cell key={entry.name} fill={STEP_COLORS[entry.event] ?? '#374151'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 7: Embeddings Page (Full-Screen 3D)

**Files:**
- Create: `frontend/src/pages/EmbeddingsPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create EmbeddingsPage**

Full-screen 3D embedding explorer with loading state and controls.

```tsx
import { useEmbeddings } from '../hooks/useEmbeddings'
import { EmbeddingSpace } from '../components/three/EmbeddingSpace'
import { GlassCard } from '../components/ui/GlassCard'
import { Loader2, RefreshCw, Box } from 'lucide-react'

export function EmbeddingsPage() {
  const { points, loading, error, refresh } = useEmbeddings()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-neon-purple" />
          <span className="text-sm font-medium text-gray-300">Embedding Space Explorer</span>
          <span className="text-xs font-mono text-gray-600">{points.length} vectors</span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 3D Scene */}
      {loading && points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <GlassCard>
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-gray-600 text-xs mt-1">Make sure the backend is running and documents are ingested.</p>
          </GlassCard>
        </div>
      ) : points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <GlassCard>
            <p className="text-gray-500 text-sm">No embeddings yet. Upload documents first.</p>
          </GlassCard>
        </div>
      ) : (
        <EmbeddingSpace points={points} className="flex-1" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add /embeddings route to App.tsx**

Add import:
```typescript
import { EmbeddingsPage } from './pages/EmbeddingsPage'
```

Add route inside `<Routes>`:
```tsx
<Route path="/embeddings" element={<EmbeddingsPage />} />
```

- [ ] **Step 3: Add Embeddings nav link to TopBar**

In `TopBar.tsx`, add a link between History and Config:
```tsx
<Link
  to="/embeddings"
  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
>
  <Box className="w-4 h-4" />
</Link>
```

Import `Box` from `lucide-react`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 8: Integration — Wire Visualizations into Panels

**Files:**
- Modify: `frontend/src/components/panels/EmbeddingPanel.tsx`
- Modify: `frontend/src/components/panels/GenerationPanel.tsx`
- Modify: `frontend/src/components/panels/RetrievalPanel.tsx`

- [ ] **Step 1: Update EmbeddingPanel with mini 3D view**

Replace the "3D coming soon" placeholder with an inline EmbeddingSpace:

```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { useEmbeddings } from '../../hooks/useEmbeddings'
import { EmbeddingSpace } from '../three/EmbeddingSpace'
import { Link } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'

export function EmbeddingPanel() {
  const data = usePipelineStore((s) => s.nodes.embedding.data)
  const { points } = useEmbeddings()

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Embedding Info
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Model</span>
            <span className="text-xs text-gray-200 font-mono truncate ml-2 max-w-[160px]">
              {(data.model as string) ?? '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Vector Dim</span>
            <span className="text-xs text-gray-200 font-mono">
              {data.vector_dim != null ? String(data.vector_dim) : '—'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Mini 3D view */}
      {points.length > 0 && (
        <GlassCard padding={false}>
          <div className="relative">
            <EmbeddingSpace points={points} className="h-[200px] rounded-xl overflow-hidden" />
            <Link
              to="/embeddings"
              className="absolute top-2 right-2 p-1.5 rounded-lg glass text-gray-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update GenerationPanel with TokenStream + ChunkRelevance**

Replace the inline answer display with the TokenStream and ChunkRelevanceBar components:

```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'
import { TokenStream } from '../viz/TokenStream'
import { ChunkRelevanceBar } from '../viz/ChunkRelevanceBar'
import { PerformanceTimeline } from '../viz/PerformanceTimeline'

export function GenerationPanel() {
  const nodeData = usePipelineStore((s) => s.nodes.generation.data)
  const latencyMs = usePipelineStore((s) => s.nodes.generation.latencyMs)
  const tokensCount = usePipelineStore((s) => s.tokens.length)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Generation
        </h4>
        <div className="flex flex-wrap gap-2">
          <MetricBadge label="model" value={(nodeData.model as string) ?? '—'} color="blue" />
          <MetricBadge label="tokens" value={tokensCount} color="purple" />
          <MetricBadge label="latency" value={latencyMs != null ? `${Math.round(latencyMs)}ms` : '—'} color="gold" />
        </div>
      </GlassCard>

      <TokenStream />
      <ChunkRelevanceBar />
      <PerformanceTimeline />
    </div>
  )
}
```

- [ ] **Step 3: Update RetrievalPanel with SimilarityMatrix**

Add the SimilarityMatrix below the chunk list:

```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { SimilarityMatrix } from '../viz/SimilarityMatrix'

export function RetrievalPanel() {
  const chunks = usePipelineStore((s) => s.chunks)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Retrieved Chunks
        </h4>
        {chunks.length === 0 ? (
          <p className="text-xs text-gray-600">No chunks retrieved yet</p>
        ) : (
          <div className="space-y-2">
            {chunks.map((chunk, i) => (
              <div key={chunk.id} className="bg-bg-tertiary rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-gray-500">Chunk {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-emerald rounded-full"
                        style={{ width: `${chunk.score * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-neon-emerald">{(chunk.score * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-300 line-clamp-2">{chunk.text}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <SimilarityMatrix />
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 9: Final Verification

- [ ] **Step 1: TypeScript check**

```bash
cd frontend && npx tsc -b --noEmit
```

- [ ] **Step 2: Oxlint check**

```bash
cd frontend && npx oxlint src/
```

- [ ] **Step 3: Production build**

```bash
cd frontend && npx vite build
```

Expected: build succeeds.

- [ ] **Step 4: Visual check in browser**

Start backend + frontend:
```bash
# Terminal 1
cd backend && ./venv/bin/uvicorn app.main:app --port 8000

# Terminal 2
cd frontend && npm run dev
```

Verify:
1. `/` — Pipeline canvas shows particle effects on edges when pipeline runs
2. Click Generation node — right panel shows TokenStream with sparkline, ChunkRelevanceBar, PerformanceTimeline
3. Click Retrieval node — shows chunk list + SimilarityMatrix heatmap
4. Click Embedding node — shows mini 3D point cloud (if documents are ingested)
5. `/embeddings` — full-screen 3D embedding explorer with orbit controls and bloom effects
6. TopBar has new Embeddings nav icon
