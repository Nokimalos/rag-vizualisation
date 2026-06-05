import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MetricBadge } from '../ui/MetricBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const { t } = useTranslation()
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
    <footer className="h-12 flex items-center justify-between px-4 bg-surface border-t border-border z-50">
      {/* Left: Playback controls (step_by_step only) */}
      <div className="flex items-center gap-1 w-[220px]">
        {mode === 'step_by_step' && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset} aria-label={t('controls.reset')} title={t('controls.reset')}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? t('controls.pause') : t('controls.play')}
              title={isPlaying ? t('controls.pause') : t('controls.play')}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextStep} aria-label={t('controls.nextStep')} title={t('controls.nextStep')}>
              <SkipForward className="h-3.5 w-3.5" />
            </Button>

            {/* Speed selector */}
            <Select value={String(speed)} onValueChange={(v) => handleSpeedChange(Number(v))}>
              <SelectTrigger className="ml-1 h-8 w-[72px] text-xs font-mono" aria-label={t('controls.speed')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs font-mono">
                    {s}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Center: Progress bar + step counter */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-xs mx-4">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {t('controls.steps', { current: currentStep, total: totalSteps })}
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
