import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './uiStore'

const initialState = useUIStore.getState()

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState(initialState, true)
  })

  it('starts in step_by_step mode with no selection', () => {
    const s = useUIStore.getState()
    expect(s.mode).toBe('step_by_step')
    expect(s.selectedNode).toBeNull()
    expect(s.rightPanelOpen).toBe(false)
  })

  it('selecting a node opens the right panel', () => {
    useUIStore.getState().setSelectedNode('embedding')
    const s = useUIStore.getState()
    expect(s.selectedNode).toBe('embedding')
    expect(s.rightPanelOpen).toBe(true)
  })

  it('clearing the selection closes the right panel', () => {
    useUIStore.getState().setSelectedNode('embedding')
    useUIStore.getState().setSelectedNode(null)
    const s = useUIStore.getState()
    expect(s.selectedNode).toBeNull()
    expect(s.rightPanelOpen).toBe(false)
  })

  it('closing the right panel clears the selected node', () => {
    useUIStore.getState().setSelectedNode('retrieval')
    useUIStore.getState().setRightPanelOpen(false)
    const s = useUIStore.getState()
    expect(s.rightPanelOpen).toBe(false)
    expect(s.selectedNode).toBeNull()
  })

  it('updates mode, speed and playback flags independently', () => {
    const { setMode, setSpeed, setIsPlaying } = useUIStore.getState()
    setMode('dashboard')
    setSpeed(2)
    setIsPlaying(true)
    const s = useUIStore.getState()
    expect(s.mode).toBe('dashboard')
    expect(s.speed).toBe(2)
    expect(s.isPlaying).toBe(true)
  })
})
