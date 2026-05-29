import { create } from 'zustand'
import type { PipelineEvent, PipelineNodeState, PipelineNodeType, NodeStatus, QueryResult, ChunkResult } from '../types'

const ALL_NODES: PipelineNodeType[] = [
  'document', 'chunking', 'embedding', 'vectorStore',
  'queryInput', 'queryEmbed', 'retrieval', 'ranking',
  'promptAssembly', 'generation', 'response',
]

function createInitialNodes(): Record<PipelineNodeType, PipelineNodeState> {
  const nodes = {} as Record<PipelineNodeType, PipelineNodeState>
  for (const id of ALL_NODES) {
    nodes[id] = { id, status: 'idle', latencyMs: null, data: {} }
  }
  return nodes
}

const EVENT_TO_NODE: Record<string, PipelineNodeType> = {
  query_received: 'queryInput', query_embedded: 'queryEmbed',
  retrieval_done: 'retrieval', reranking_done: 'ranking',
  prompt_assembled: 'promptAssembly', generation_start: 'generation',
  token_generated: 'generation', generation_done: 'generation',
  pipeline_complete: 'response', document_received: 'document',
  document_parsed: 'document', chunking_done: 'chunking',
  chunk_embedded: 'embedding', indexing_done: 'vectorStore',
}

interface PipelineStore {
  nodes: Record<PipelineNodeType, PipelineNodeState>
  events: PipelineEvent[]
  currentStep: number
  totalSteps: number
  runId: string | null
  isRunning: boolean
  answer: string
  tokens: string[]
  chunks: ChunkResult[]
  processEvent: (event: PipelineEvent) => void
  reset: () => void
  setResult: (result: QueryResult) => void
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  nodes: createInitialNodes(),
  events: [], currentStep: 0, totalSteps: 8,
  runId: null, isRunning: false, answer: '', tokens: [], chunks: [],

  processEvent: (event) => {
    const nodeType = EVENT_TO_NODE[event.event]
    set((state) => {
      const newNodes = { ...state.nodes }
      if (nodeType) {
        let newStatus: NodeStatus = 'done'
        if (event.event === 'generation_start' || event.event === 'token_generated') newStatus = 'processing'
        newNodes[nodeType] = {
          ...newNodes[nodeType], status: newStatus,
          latencyMs: (event.data.latency_ms as number) ?? newNodes[nodeType].latencyMs,
          data: { ...newNodes[nodeType].data, ...event.data },
        }
      }
      if (event.event === 'step_failed' && event.data.step) {
        // Map step name to node type for error display
        const stepToNode: Record<string, PipelineNodeType> = {
          embedding: 'embedding', retrieval: 'retrieval', generation: 'generation',
          query_embedding: 'queryEmbed', prompt_assembly: 'promptAssembly',
        }
        const failedNode = stepToNode[event.data.step as string]
        if (failedNode) {
          newNodes[failedNode] = { ...newNodes[failedNode], status: 'error', data: { ...newNodes[failedNode].data, ...event.data } }
        }
      }
      const newTokens = event.event === 'token_generated' ? [...state.tokens, event.data.token as string] : state.tokens
      const newChunks = event.event === 'retrieval_done' ? (event.data.chunks as ChunkResult[]) ?? state.chunks : state.chunks
      return {
        nodes: newNodes, events: [...state.events, event],
        currentStep: event.step, totalSteps: event.total_steps,
        isRunning: event.event !== 'pipeline_complete',
        tokens: newTokens, answer: newTokens.join(''), chunks: newChunks,
      }
    })
  },

  reset: () => set({
    nodes: createInitialNodes(), events: [], currentStep: 0, totalSteps: 8,
    runId: null, isRunning: false, answer: '', tokens: [], chunks: [],
  }),

  setResult: (result) => set((state) => {
    // Mark all nodes as done when we get a REST result
    const doneNodes = { ...state.nodes }
    for (const key of Object.keys(doneNodes) as PipelineNodeType[]) {
      doneNodes[key] = { ...doneNodes[key], status: 'done' }
    }
    return {
      nodes: doneNodes,
      runId: result.run_id,
      answer: result.answer ?? '',
      chunks: result.chunks ?? [],
      tokens: (result.answer ?? '').split(''),
      isRunning: false,
      currentStep: 8,
      totalSteps: 8,
    }
  }),
}))
