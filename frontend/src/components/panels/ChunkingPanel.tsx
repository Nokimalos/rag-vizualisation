import { useState, useEffect } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { useUIStore } from '../../stores/uiStore'
import { api } from '../../services/api'

export function ChunkingPanel() {
  const activeCollection = useUIStore((s) => s.activeCollection)
  const [totalChunks, setTotalChunks] = useState(0)

  useEffect(() => {
    api.getEmbeddings3D(activeCollection)
      .then((data) => setTotalChunks(data.total))
      .catch(() => setTotalChunks(0))
  }, [activeCollection])

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Chunking Configuration
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Strategy</span>
            <span className="text-xs text-neon-blue font-mono">hybrid</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Method</span>
            <span className="text-xs text-gray-200 font-mono">structure + semantic</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Max chunk size</span>
            <span className="text-xs text-gray-200 font-mono">1500 chars</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Total chunks</span>
            <span className="text-xs text-gray-200 font-mono">{totalChunks}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Documents are split using hybrid chunking: section headers (CAPS, markdown #) force boundaries, then semantic similarity groups related content together. Each chunk stays under 1500 chars and represents a coherent topic.
        </p>
      </GlassCard>
    </div>
  )
}
