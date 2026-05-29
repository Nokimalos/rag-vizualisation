import type { PipelineNodeType } from '../../types'
import { DocumentPanel } from './DocumentPanel'
import { ChunkingPanel } from './ChunkingPanel'
import { EmbeddingPanel } from './EmbeddingPanel'
import { VectorStorePanel } from './VectorStorePanel'
import { RetrievalPanel } from './RetrievalPanel'
import { RankingPanel } from './RankingPanel'
import { PromptPanel } from './PromptPanel'
import { GenerationPanel } from './GenerationPanel'

interface PanelRouterProps {
  nodeType: PipelineNodeType
}

export function PanelRouter({ nodeType }: PanelRouterProps) {
  switch (nodeType) {
    case 'document':
      return <DocumentPanel />
    case 'chunking':
      return <ChunkingPanel />
    case 'embedding':
      return <EmbeddingPanel />
    case 'vectorStore':
      return <VectorStorePanel />
    case 'queryInput':
      return <DocumentPanel />
    case 'queryEmbed':
      return <EmbeddingPanel />
    case 'retrieval':
      return <RetrievalPanel />
    case 'ranking':
      return <RankingPanel />
    case 'promptAssembly':
      return <PromptPanel />
    case 'generation':
      return <GenerationPanel />
    case 'response':
      return <GenerationPanel />
    default:
      return null
  }
}
