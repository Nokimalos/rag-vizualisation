import { useState, useMemo } from 'react'
import * as d3 from 'd3'
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import type { SimilarityCell } from '../../types'

// Word-frequency TF vector
function tfVector(text: string): Map<string, number> {
  const words = text.toLowerCase().match(/\b\w+\b/g) ?? []
  const map = new Map<string, number>()
  for (const w of words) map.set(w, (map.get(w) ?? 0) + 1)
  return map
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (const [w, v] of a) {
    dot += v * (b.get(w) ?? 0)
    magA += v * v
  }
  for (const v of b.values()) magB += v * v
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function SimilarityMatrix() {
  const chunks = usePipelineStore((s) => s.chunks)
  const [selectedCell, setSelectedCell] = useState<SimilarityCell | null>(null)

  const { cells, n, cellSize, margin } = useMemo(() => {
    const n = chunks.length
    if (n < 2) return { cells: [], n, cellSize: 40, margin: { top: 24, left: 24 } }

    const cellSize = Math.min(40, Math.floor(200 / n))
    const margin = { top: 24, left: 24 }
    const vectors = chunks.map((c) => tfVector(c.text))
    const cells: SimilarityCell[] = []

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        cells.push({
          row: r,
          col: c,
          score: cosineSimilarity(vectors[r], vectors[c]),
          rowLabel: `C${r + 1}`,
          colLabel: `C${c + 1}`,
        })
      }
    }
    return { cells, n, cellSize, margin }
  }, [chunks])

  if (chunks.length < 2) return null

  const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1])
  const svgWidth = margin.left + n * cellSize
  const svgHeight = margin.top + n * cellSize

  return (
    <GlassCard>
      <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Chunk Similarity Matrix
      </h4>

      <div className="overflow-auto">
        <svg width={svgWidth} height={svgHeight} className="block">
          {/* Column labels */}
          {Array.from({ length: n }, (_, i) => (
            <text
              key={`col-${i}`}
              x={margin.left + i * cellSize + cellSize / 2}
              y={margin.top - 6}
              textAnchor="middle"
              className="font-mono fill-gray-400"
              fontSize={10}
            >
              C{i + 1}
            </text>
          ))}

          {/* Row labels */}
          {Array.from({ length: n }, (_, i) => (
            <text
              key={`row-${i}`}
              x={margin.left - 4}
              y={margin.top + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="font-mono fill-gray-400"
              fontSize={10}
            >
              C{i + 1}
            </text>
          ))}

          {/* Cells */}
          {cells.map((cell) => {
            const x = margin.left + cell.col * cellSize
            const y = margin.top + cell.row * cellSize
            const isSelected =
              selectedCell?.row === cell.row && selectedCell?.col === cell.col
            return (
              <rect
                key={`${cell.row}-${cell.col}`}
                x={x}
                y={y}
                width={cellSize - 1}
                height={cellSize - 1}
                fill={colorScale(cell.score)}
                stroke={isSelected ? '#f59e0b' : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                className="cursor-pointer"
                onClick={() => setSelectedCell(isSelected ? null : cell)}
              >
                <title>{`${cell.rowLabel} vs ${cell.colLabel}: ${(cell.score * 100).toFixed(1)}%`}</title>
              </rect>
            )
          })}
        </svg>
      </div>

      {/* Selected cell detail */}
      {selectedCell && (
        <div className="mt-3 pt-3 border-t border-glass-border">
          <p className="text-[10px] font-mono text-gray-400 mb-2">
            {selectedCell.rowLabel} vs {selectedCell.colLabel} —{' '}
            <span className="text-neon-gold">{(selectedCell.score * 100).toFixed(1)}% similarity</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-mono text-neon-purple mb-1">{selectedCell.rowLabel}</p>
              <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                {chunks[selectedCell.row]?.text}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-neon-blue mb-1">{selectedCell.colLabel}</p>
              <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                {chunks[selectedCell.col]?.text}
              </p>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
