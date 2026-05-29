export type PipelineEventType =
  | 'query_received' | 'query_embedded' | 'retrieval_done' | 'reranking_done'
  | 'prompt_assembled' | 'generation_start' | 'token_generated' | 'generation_done'
  | 'pipeline_complete' | 'document_received' | 'document_parsed' | 'chunking_done'
  | 'chunk_embedded' | 'indexing_done' | 'step_failed'

export type PipelineMode = 'step_by_step' | 'dashboard'
export type NodeStatus = 'idle' | 'processing' | 'done' | 'error'

export type PipelineNodeType =
  | 'document' | 'chunking' | 'embedding' | 'vectorStore'
  | 'queryInput' | 'queryEmbed' | 'retrieval' | 'ranking'
  | 'promptAssembly' | 'generation' | 'response'

export interface PipelineEvent {
  type: 'pipeline_event'
  event: PipelineEventType
  step: number
  total_steps: number
  data: Record<string, unknown>
  timestamp: string
}

export interface WSErrorEvent {
  type: 'error'
  event: string
  data: { error: string; recoverable?: boolean }
}

export interface WSPongEvent { type: 'pong' }
export interface WSQueryCompleteEvent { type: 'query_complete'; data: QueryResult }
export type WSMessage = PipelineEvent | WSErrorEvent | WSPongEvent | WSQueryCompleteEvent

export interface QueryRequest { text: string; mode: PipelineMode }
export interface QueryResult {
  run_id: string; answer: string | null; total_latency_ms: number; chunks: ChunkResult[]
}
export interface ChunkResult { id: string; text: string; score: number }

export interface DocumentInfo {
  id: string; filename: string; file_type: string; size_bytes: number; num_chunks: number; uploaded_at: string
}

export interface ProviderInfo {
  llm: { available: string[]; active: string | null }
  embedding: { available: string[]; active: string | null }
  vectordb: { available: string[]; active: string | null }
}

export interface ProviderConfigUpdate {
  provider_type: 'llm' | 'embedding' | 'vectordb'
  provider_name: string
  model?: string
  settings?: Record<string, unknown>
}

export interface PipelineStats { total_runs: number; avg_latency_ms: number; total_documents: number }

export interface RunHistory {
  run: { id: string; query: string; status: string; answer: string | null; total_latency_ms: number | null; created_at: string }
  events: PipelineEvent[]
}

export interface PipelineNodeState {
  id: PipelineNodeType; status: NodeStatus; latencyMs: number | null; data: Record<string, unknown>
}

export interface SimilarityCell {
  row: number; col: number; score: number; rowLabel: string; colLabel: string
}

export interface EmbeddingPoint {
  id: string; x: number; y: number; z: number; text: string; metadata: Record<string, unknown>
}
