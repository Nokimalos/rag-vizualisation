import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function PromptPanel() {
  const data = usePipelineStore((s) => s.nodes.promptAssembly.data)

  return (
    <div className="space-y-3">
      <GlassCard>
        <h4 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Prompt Assembly
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Chunks Injected</span>
            <span className="text-xs text-gray-200 font-mono">
              {data.chunks_injected != null ? String(data.chunks_injected) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-mono">Total Chars</span>
            <span className="text-xs text-gray-200 font-mono">
              {data.total_chars != null ? Number(data.total_chars).toLocaleString() : '—'}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
