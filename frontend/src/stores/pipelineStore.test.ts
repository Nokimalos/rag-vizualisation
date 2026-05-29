import { beforeEach, describe, expect, it } from 'vitest'
import { usePipelineStore } from './pipelineStore'
import type { PipelineEvent } from '../types'

function event(partial: Partial<PipelineEvent> & Pick<PipelineEvent, 'event'>): PipelineEvent {
  return {
    type: 'pipeline_event',
    step: 1,
    total_steps: 8,
    data: {},
    timestamp: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset()
  })

  it('initialises all nodes as idle', () => {
    const { nodes } = usePipelineStore.getState()
    expect(Object.keys(nodes)).toHaveLength(11)
    expect(Object.values(nodes).every((n) => n.status === 'idle')).toBe(true)
  })

  it('maps an event to its node and marks it done with latency', () => {
    usePipelineStore.getState().processEvent(
      event({ event: 'retrieval_done', data: { latency_ms: 42 } }),
    )
    const { nodes } = usePipelineStore.getState()
    expect(nodes.retrieval.status).toBe('done')
    expect(nodes.retrieval.latencyMs).toBe(42)
  })

  it('keeps the generation node in processing while tokens stream', () => {
    const store = usePipelineStore.getState()
    store.processEvent(event({ event: 'generation_start' }))
    store.processEvent(event({ event: 'token_generated', data: { token: 'Hel' } }))
    store.processEvent(event({ event: 'token_generated', data: { token: 'lo' } }))
    const s = usePipelineStore.getState()
    expect(s.nodes.generation.status).toBe('processing')
    expect(s.tokens).toEqual(['Hel', 'lo'])
    expect(s.answer).toBe('Hello')
  })

  it('stores retrieved chunks from retrieval_done', () => {
    usePipelineStore.getState().processEvent(
      event({ event: 'retrieval_done', data: { chunks: [{ id: 'c1', text: 'x', score: 0.9 }] } }),
    )
    expect(usePipelineStore.getState().chunks).toEqual([{ id: 'c1', text: 'x', score: 0.9 }])
  })

  it('marks a node as error on step_failed', () => {
    usePipelineStore.getState().processEvent(
      event({ event: 'step_failed', data: { step: 'embedding', error: 'boom' } }),
    )
    expect(usePipelineStore.getState().nodes.embedding.status).toBe('error')
  })

  it('clears isRunning when the pipeline completes', () => {
    usePipelineStore.getState().processEvent(event({ event: 'pipeline_complete', step: 8 }))
    expect(usePipelineStore.getState().isRunning).toBe(false)
  })

  it('reset() restores the initial state', () => {
    const store = usePipelineStore.getState()
    store.processEvent(event({ event: 'token_generated', data: { token: 'a' } }))
    store.reset()
    const s = usePipelineStore.getState()
    expect(s.tokens).toEqual([])
    expect(s.answer).toBe('')
    expect(s.events).toEqual([])
    expect(Object.values(s.nodes).every((n) => n.status === 'idle')).toBe(true)
  })

  it('setResult() marks every node done and fills the answer', () => {
    usePipelineStore.getState().setResult({
      run_id: 'run-1',
      answer: 'final answer',
      total_latency_ms: 100,
      chunks: [{ id: 'c1', text: 'x', score: 0.5 }],
    })
    const s = usePipelineStore.getState()
    expect(s.runId).toBe('run-1')
    expect(s.answer).toBe('final answer')
    expect(s.isRunning).toBe(false)
    expect(Object.values(s.nodes).every((n) => n.status === 'done')).toBe(true)
  })
})
