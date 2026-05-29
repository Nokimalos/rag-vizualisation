import { create } from 'zustand'
import type { PipelineMode, PipelineNodeType } from '../types'

interface UIStore {
  mode: PipelineMode; setMode: (mode: PipelineMode) => void
  selectedNode: PipelineNodeType | null; setSelectedNode: (node: PipelineNodeType | null) => void
  isPlaying: boolean; speed: number; setIsPlaying: (playing: boolean) => void; setSpeed: (speed: number) => void
  rightPanelOpen: boolean; setRightPanelOpen: (open: boolean) => void
  queryLoading: boolean; setQueryLoading: (loading: boolean) => void
  activeCollection: string; setActiveCollection: (collection: string) => void
  wsConnected: boolean; setWsConnected: (connected: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  mode: 'step_by_step', setMode: (mode) => set({ mode }),
  selectedNode: null, setSelectedNode: (node) => set({ selectedNode: node, rightPanelOpen: node !== null }),
  isPlaying: false, speed: 1, setIsPlaying: (isPlaying) => set({ isPlaying }), setSpeed: (speed) => set({ speed }),
  rightPanelOpen: false, setRightPanelOpen: (open) => set(open ? { rightPanelOpen: true } : { rightPanelOpen: false, selectedNode: null }),
  queryLoading: false, setQueryLoading: (queryLoading) => set({ queryLoading }),
  activeCollection: 'default', setActiveCollection: (activeCollection) => set({ activeCollection }),
  wsConnected: false, setWsConnected: (connected) => set({ wsConnected: connected }),
}))
