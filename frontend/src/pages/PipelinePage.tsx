import { useCallback } from 'react'
import { LeftPanel } from '../components/layout/LeftPanel'
import { BottomBar } from '../components/layout/BottomBar'
import { RightPanel } from '../components/layout/RightPanel'
import { PipelineCanvas } from '../components/canvas/PipelineCanvas'
import { usePipelineEvents } from '../hooks/usePipelineEvents'
import { usePipelineStore } from '../stores/pipelineStore'
import { useUIStore } from '../stores/uiStore'
import type { PipelineMode } from '../types'

export function PipelinePage() {
  const { startQuery, nextStep, pause, resume, setSpeed } = usePipelineEvents()
  const reset = usePipelineStore((s) => s.reset)
  const setIsPlaying = useUIStore((s) => s.setIsPlaying)

  const handleQuery = useCallback(
    (text: string, mode: PipelineMode, collection: string) => {
      startQuery(text, mode, collection)
      setIsPlaying(true)
    },
    [startQuery, setIsPlaying],
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel onQuery={handleQuery} />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <PipelineCanvas />
          </div>
          <RightPanel />
        </div>
      </div>
      <BottomBar
        onPlay={() => { setIsPlaying(true); resume() }}
        onPause={() => { setIsPlaying(false); pause() }}
        onNextStep={nextStep}
        onReset={() => { setIsPlaying(false); reset() }}
        onSpeedChange={setSpeed}
      />
    </div>
  )
}
