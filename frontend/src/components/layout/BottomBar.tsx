import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { MetricBadge } from '../ui/MetricBadge'
import { useUIStore } from '../../stores/uiStore'
import { usePipelineStore } from '../../stores/pipelineStore'

interface BottomBarProps {
  onPlay: () => void
  onPause: () => void
  onNextStep: () => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
}

const SPEED_OPTIONS = [0.5, 1, 2, 5]

export function BottomBar({ onPlay, onPause, onNextStep, onReset, onSpeedChange }: BottomBarProps) {
  const mode = useUIStore((s) => s.mode)
  const isPlaying = useUIStore((s) => s.isPlaying)
  const speed = useUIStore((s) => s.speed)
  const setSpeed = useUIStore((s) => s.setSpeed)
  const currentStep = usePipelineStore((s) => s.currentStep)
  const totalSteps = usePipelineStore((s) => s.totalSteps)
  const tokens = usePipelineStore((s) => s.tokens)
  const chunks = usePipelineStore((s) => s.chunks)

  const progress = totalSteps > 0 ? Math.min((currentStep / totalSteps) * 100, 100) : 0
  const latencyMs = usePipelineStore((s) => {
    const gen = s.nodes['generation']
    return gen.latencyMs
  })

  const handleSpeedChange = (s: number) => {
    setSpeed(s)
    onSpeedChange(s)
  }

  return (
    <footer className="h-12 flex items-center justify-between px-4 glass border-t border-glass-border z-50">
      {/* Left: Playback controls (step_by_step only) */}
      <div className="flex items-center gap-2 w-[220px]">
        {mode === 'step_by_step' && (
          <>
            <button
              onClick={onReset}
              title="Reset"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-glass-bg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={isPlaying ? onPause : onPlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-1.5 rounded-md text-neon-blue hover:bg-neon-blue/10 transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onNextStep}
              title="Next Step"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-glass-bg transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Speed selector */}
            <div className="flex items-center gap-0.5 ml-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    speed === s
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Center: Progress bar + step counter */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-xs mx-4">
        <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(to right, #00d4ff, #8b5cf6)',
            }}
          />
        </div>
        <span className="text-[10px] font-mono text-gray-500">
          {currentStep}/{totalSteps} steps
        </span>
      </div>

      {/* Right: Metrics */}
      <div className="flex items-center gap-2 w-[220px] justify-end">
        <MetricBadge
          label="latency"
          value={latencyMs != null ? `${latencyMs}ms` : '—'}
          color="blue"
        />
        <MetricBadge
          label="tokens"
          value={tokens.length}
          color="purple"
        />
        <MetricBadge
          label="chunks"
          value={chunks.length}
          color="emerald"
        />
      </div>
    </footer>
  )
}
