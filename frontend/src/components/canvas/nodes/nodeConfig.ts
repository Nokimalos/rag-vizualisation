import type { PipelineNodeType } from '../../../types'

export interface NodeConfig {
  id: PipelineNodeType
  label: string
  icon: string  // Lucide icon name
  x: number
  y: number
  color: string
}

export const PIPELINE_NODES: NodeConfig[] = [
  { id: 'document', label: 'Document', icon: 'FileText', x: 0, y: 0, color: '#00d4ff' },
  { id: 'chunking', label: 'Chunking', icon: 'Scissors', x: 250, y: 0, color: '#00d4ff' },
  { id: 'embedding', label: 'Embedding', icon: 'Binary', x: 500, y: 0, color: '#8b5cf6' },
  { id: 'vectorStore', label: 'Vector Store', icon: 'Database', x: 750, y: 0, color: '#8b5cf6' },
  { id: 'queryInput', label: 'Query', icon: 'MessageCircle', x: 0, y: 200, color: '#10b981' },
  { id: 'queryEmbed', label: 'Query Embed', icon: 'Binary', x: 250, y: 200, color: '#8b5cf6' },
  { id: 'retrieval', label: 'Retrieval', icon: 'Search', x: 750, y: 200, color: '#10b981' },
  { id: 'ranking', label: 'Ranking', icon: 'ArrowUpDown', x: 750, y: 350, color: '#10b981' },
  { id: 'promptAssembly', label: 'Prompt', icon: 'Layers', x: 750, y: 500, color: '#f59e0b' },
  { id: 'generation', label: 'Generation', icon: 'Sparkles', x: 750, y: 650, color: '#f59e0b' },
  { id: 'response', label: 'Response', icon: 'Send', x: 750, y: 800, color: '#f59e0b' },
]

export const PIPELINE_EDGES = [
  { id: 'e-doc-chunk', source: 'document', target: 'chunking' },
  { id: 'e-chunk-embed', source: 'chunking', target: 'embedding' },
  { id: 'e-embed-store', source: 'embedding', target: 'vectorStore' },
  { id: 'e-query-qembed', source: 'queryInput', target: 'queryEmbed' },
  { id: 'e-qembed-retrieval', source: 'queryEmbed', target: 'retrieval' },
  { id: 'e-store-retrieval', source: 'vectorStore', target: 'retrieval' },
  { id: 'e-retrieval-ranking', source: 'retrieval', target: 'ranking' },
  { id: 'e-ranking-prompt', source: 'ranking', target: 'promptAssembly' },
  { id: 'e-prompt-gen', source: 'promptAssembly', target: 'generation' },
  { id: 'e-gen-response', source: 'generation', target: 'response' },
]
