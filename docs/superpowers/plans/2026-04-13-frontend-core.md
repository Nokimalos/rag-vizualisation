# Frontend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React frontend for the RAG pipeline visualization — interactive pipeline canvas with React Flow, 4-zone layout, WebSocket real-time events, Zustand state management, playback controls, and detail panels.

**Architecture:** Vite + React 18 + TypeScript app with a 4-zone layout (left sidebar, central canvas, right detail panel, bottom controls). React Flow renders the pipeline graph with custom nodes showing processing state. WebSocket streams pipeline events from the FastAPI backend. Zustand manages pipeline state, provider config, and UI state. Framer Motion handles panel animations.

**Tech Stack:** React 18, TypeScript 5, Vite 5, React Flow 11, TailwindCSS 3, Zustand 4, Framer Motion 11, React Router 6, Recharts 2, Lucide React

---

## File Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                          # Tailwind directives + custom dark theme
│   ├── types/
│   │   └── index.ts                       # All TypeScript types (mirrors backend schemas)
│   ├── services/
│   │   └── api.ts                         # REST API client (fetch wrapper)
│   ├── hooks/
│   │   ├── useWebSocket.ts                # WebSocket connection + reconnect
│   │   └── usePipelineEvents.ts           # Process WS events into store updates
│   ├── stores/
│   │   ├── pipelineStore.ts               # Pipeline state, events, current run
│   │   ├── providerStore.ts               # Provider config, active providers
│   │   └── uiStore.ts                     # UI state (mode, selected node, panels)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx                 # Logo, mode toggle, config/nav links
│   │   │   ├── LeftPanel.tsx              # Query input, doc upload, run history
│   │   │   ├── RightPanel.tsx             # Slide-in detail panel container
│   │   │   └── BottomBar.tsx              # Playback controls, timeline, metrics
│   │   ├── canvas/
│   │   │   ├── PipelineCanvas.tsx         # React Flow wrapper with pipeline graph
│   │   │   ├── nodes/
│   │   │   │   ├── PipelineNode.tsx       # Custom node component (all types)
│   │   │   │   └── nodeConfig.ts          # Node positions, labels, colors
│   │   │   └── edges/
│   │   │       └── AnimatedEdge.tsx       # Custom animated edge with color coding
│   │   ├── panels/
│   │   │   ├── DocumentPanel.tsx          # Document preview + metadata
│   │   │   ├── ChunkingPanel.tsx          # Chunk list + visual splitting
│   │   │   ├── EmbeddingPanel.tsx         # Embedding info (3D deferred to Plan 3)
│   │   │   ├── VectorStorePanel.tsx       # Collection stats
│   │   │   ├── RetrievalPanel.tsx         # Chunks + similarity scores
│   │   │   ├── RankingPanel.tsx           # Before/after reranking
│   │   │   ├── PromptPanel.tsx            # Full prompt with highlighted chunks
│   │   │   ├── GenerationPanel.tsx        # Streamed response + metrics
│   │   │   └── PanelRouter.tsx            # Routes to correct panel by node type
│   │   └── ui/
│   │       ├── GlassCard.tsx              # Glassmorphism card wrapper
│   │       └── MetricBadge.tsx            # Small metric display (latency, tokens)
│   └── pages/
│       ├── PipelinePage.tsx               # Main canvas view (route: /)
│       ├── HistoryPage.tsx                # Run history table (route: /history)
│       └── ConfigPage.tsx                 # Provider config (route: /config)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "rag-vizualisation-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "@xyflow/react": "^12.6.0",
    "zustand": "^4.5.5",
    "framer-motion": "^11.11.0",
    "recharts": "^2.13.3",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create Tailwind config with dark theme**

`tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a2e',
        },
        neon: {
          blue: '#00d4ff',
          purple: '#8b5cf6',
          emerald: '#10b981',
          gold: '#f59e0b',
        },
        glass: {
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 40px currentColor' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

`postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RAG Pipeline Visualization</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  </head>
  <body class="bg-bg-primary text-white font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create index.css with dark theme**

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: dark;
  }
  body {
    background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
    min-height: 100vh;
  }
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
}

@layer components {
  .glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .glow-blue { box-shadow: 0 0 15px rgba(0, 212, 255, 0.3); }
  .glow-purple { box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }
  .glow-emerald { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
  .glow-gold { box-shadow: 0 0 15px rgba(245, 158, 11, 0.3); }
}
```

- [ ] **Step 7: Create main.tsx and App.tsx**

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

`src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'

function PipelinePage() {
  return <div className="text-neon-blue text-2xl p-8">Pipeline Canvas — Coming Soon</div>
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <Routes>
        <Route path="/" element={<PipelinePage />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 8: Install dependencies and verify**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — should see dark page with "Pipeline Canvas — Coming Soon" in neon blue.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd frontend
npx tsc -b --noEmit
```

Expected: no errors.

---

## Task 2: TypeScript Types

**Files:**
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: Create all TypeScript types mirroring backend schemas**

```typescript
// --- Enums ---

export type PipelineEventType =
  | 'query_received'
  | 'query_embedded'
  | 'retrieval_done'
  | 'reranking_done'
  | 'prompt_assembled'
  | 'generation_start'
  | 'token_generated'
  | 'generation_done'
  | 'pipeline_complete'
  | 'document_received'
  | 'document_parsed'
  | 'chunking_done'
  | 'chunk_embedded'
  | 'indexing_done'
  | 'step_failed'

export type PipelineMode = 'step_by_step' | 'dashboard'

export type NodeStatus = 'idle' | 'processing' | 'done' | 'error'

export type PipelineNodeType =
  | 'document'
  | 'chunking'
  | 'embedding'
  | 'vectorStore'
  | 'queryInput'
  | 'queryEmbed'
  | 'retrieval'
  | 'ranking'
  | 'promptAssembly'
  | 'generation'
  | 'response'

// --- Events ---

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

export interface WSPongEvent {
  type: 'pong'
}

export type WSMessage = PipelineEvent | WSErrorEvent | WSPongEvent

// --- API Types ---

export interface QueryRequest {
  text: string
  mode: PipelineMode
}

export interface QueryResult {
  run_id: string
  answer: string | null
  total_latency_ms: number
  chunks: ChunkResult[]
}

export interface ChunkResult {
  id: string
  text: string
  score: number
}

export interface DocumentInfo {
  id: string
  filename: string
  file_type: string
  size_bytes: number
  num_chunks: number
  uploaded_at: string
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

export interface PipelineStats {
  total_runs: number
  avg_latency_ms: number
  total_documents: number
}

export interface RunHistory {
  run: {
    id: string
    query: string
    status: string
    answer: string | null
    total_latency_ms: number | null
    created_at: string
  }
  events: PipelineEvent[]
}

// --- Node State ---

export interface PipelineNodeState {
  id: PipelineNodeType
  status: NodeStatus
  latencyMs: number | null
  data: Record<string, unknown>
}

// --- Embedding 3D ---

export interface EmbeddingPoint {
  id: string
  x: number
  y: number
  z: number
  text: string
  metadata: Record<string, unknown>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: no errors.

---

## Task 3: API Client Service

**Files:**
- Create: `frontend/src/services/api.ts`

- [ ] **Step 1: Create REST API client**

```typescript
import type {
  DocumentInfo,
  ProviderInfo,
  ProviderConfigUpdate,
  PipelineStats,
  QueryResult,
  RunHistory,
  EmbeddingPoint,
} from '../types'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  // Documents
  listDocuments: () => request<DocumentInfo[]>('/documents'),

  uploadDocument: async (file: File, collection = 'default') => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${BASE_URL}/documents/upload?collection=${collection}`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    return response.json() as Promise<DocumentInfo>
  },

  // Query
  runQuery: (text: string, mode: string = 'dashboard') =>
    request<QueryResult>('/query', {
      method: 'POST',
      body: JSON.stringify({ text, mode }),
    }),

  getRunHistory: (runId: string) => request<RunHistory>(`/query/${runId}/history`),

  // Providers
  getProviders: () => request<ProviderInfo>('/providers'),

  updateProvider: (config: ProviderConfigUpdate) =>
    request<{ status: string }>('/providers/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  // Stats
  getStats: () => request<PipelineStats>('/stats'),

  // Embeddings
  getEmbeddings3D: (collection = 'default') =>
    request<{ points: EmbeddingPoint[]; total: number }>(`/embeddings/3d?collection=${collection}`),
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 4: Zustand Stores

**Files:**
- Create: `frontend/src/stores/pipelineStore.ts`
- Create: `frontend/src/stores/providerStore.ts`
- Create: `frontend/src/stores/uiStore.ts`

- [ ] **Step 1: Create pipeline store**

```typescript
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

// Map pipeline event types to which node they affect
const EVENT_TO_NODE: Record<string, PipelineNodeType> = {
  query_received: 'queryInput',
  query_embedded: 'queryEmbed',
  retrieval_done: 'retrieval',
  reranking_done: 'ranking',
  prompt_assembled: 'promptAssembly',
  generation_start: 'generation',
  token_generated: 'generation',
  generation_done: 'generation',
  pipeline_complete: 'response',
  document_received: 'document',
  document_parsed: 'document',
  chunking_done: 'chunking',
  chunk_embedded: 'embedding',
  indexing_done: 'vectorStore',
}

interface PipelineStore {
  // State
  nodes: Record<PipelineNodeType, PipelineNodeState>
  events: PipelineEvent[]
  currentStep: number
  totalSteps: number
  runId: string | null
  isRunning: boolean
  answer: string
  tokens: string[]
  chunks: ChunkResult[]

  // Actions
  processEvent: (event: PipelineEvent) => void
  reset: () => void
  setResult: (result: QueryResult) => void
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  nodes: createInitialNodes(),
  events: [],
  currentStep: 0,
  totalSteps: 8,
  runId: null,
  isRunning: false,
  answer: '',
  tokens: [],
  chunks: [],

  processEvent: (event) => {
    const nodeType = EVENT_TO_NODE[event.event]
    set((state) => {
      const newNodes = { ...state.nodes }
      if (nodeType) {
        const prevStatus = newNodes[nodeType].status
        let newStatus: NodeStatus = 'done'
        if (event.event === 'generation_start') newStatus = 'processing'
        if (event.event === 'token_generated') newStatus = 'processing'
        if (event.event === 'step_failed') newStatus = 'error'

        newNodes[nodeType] = {
          ...newNodes[nodeType],
          status: newStatus,
          latencyMs: (event.data.latency_ms as number) ?? newNodes[nodeType].latencyMs,
          data: { ...newNodes[nodeType].data, ...event.data },
        }
      }

      const newTokens = event.event === 'token_generated'
        ? [...state.tokens, event.data.token as string]
        : state.tokens

      const newChunks = event.event === 'retrieval_done'
        ? (event.data.chunks as ChunkResult[]) ?? state.chunks
        : state.chunks

      return {
        nodes: newNodes,
        events: [...state.events, event],
        currentStep: event.step,
        totalSteps: event.total_steps,
        isRunning: event.event !== 'pipeline_complete',
        tokens: newTokens,
        answer: newTokens.join(''),
        chunks: newChunks,
      }
    })
  },

  reset: () => set({
    nodes: createInitialNodes(),
    events: [],
    currentStep: 0,
    totalSteps: 8,
    runId: null,
    isRunning: false,
    answer: '',
    tokens: [],
    chunks: [],
  }),

  setResult: (result) => set({
    runId: result.run_id,
    answer: result.answer ?? '',
    chunks: result.chunks,
  }),
}))
```

- [ ] **Step 2: Create provider store**

```typescript
import { create } from 'zustand'
import type { ProviderInfo } from '../types'
import { api } from '../services/api'

interface ProviderStore {
  providers: ProviderInfo | null
  loading: boolean
  error: string | null
  fetchProviders: () => Promise<void>
  setActiveProvider: (type: 'llm' | 'embedding' | 'vectordb', name: string) => Promise<void>
}

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: null,
  loading: false,
  error: null,

  fetchProviders: async () => {
    set({ loading: true, error: null })
    try {
      const providers = await api.getProviders()
      set({ providers, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  setActiveProvider: async (type, name) => {
    try {
      await api.updateProvider({ provider_type: type, provider_name: name })
      const providers = await api.getProviders()
      set({ providers })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
```

- [ ] **Step 3: Create UI store**

```typescript
import { create } from 'zustand'
import type { PipelineMode, PipelineNodeType } from '../types'

interface UIStore {
  // Mode
  mode: PipelineMode
  setMode: (mode: PipelineMode) => void

  // Selected node (for right panel)
  selectedNode: PipelineNodeType | null
  setSelectedNode: (node: PipelineNodeType | null) => void

  // Playback
  isPlaying: boolean
  speed: number
  setIsPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void

  // Right panel
  rightPanelOpen: boolean
  setRightPanelOpen: (open: boolean) => void

  // Connection
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  mode: 'step_by_step',
  setMode: (mode) => set({ mode }),

  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node, rightPanelOpen: node !== null }),

  isPlaying: false,
  speed: 1,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),

  rightPanelOpen: false,
  setRightPanelOpen: (open) => set({ rightPanelOpen: open, selectedNode: open ? undefined : null }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 5: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/usePipelineEvents.ts`

- [ ] **Step 1: Create WebSocket hook with reconnect**

```typescript
import { useEffect, useRef, useCallback } from 'react'
import type { WSMessage } from '../types'
import { useUIStore } from '../stores/uiStore'

interface UseWebSocketOptions {
  onMessage: (message: WSMessage) => void
}

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempts = useRef(0)
  const setWsConnected = useUIStore((s) => s.setWsConnected)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/pipeline`)

    ws.onopen = () => {
      setWsConnected(true)
      reconnectAttempts.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage
        onMessage(message)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000)
      reconnectAttempts.current++
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [onMessage, setWsConnected])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
```

- [ ] **Step 2: Create pipeline events hook**

```typescript
import { useCallback } from 'react'
import type { WSMessage, PipelineMode } from '../types'
import { usePipelineStore } from '../stores/pipelineStore'
import { useWebSocket } from './useWebSocket'

export function usePipelineEvents() {
  const processEvent = usePipelineStore((s) => s.processEvent)
  const reset = usePipelineStore((s) => s.reset)

  const onMessage = useCallback((message: WSMessage) => {
    if (message.type === 'pipeline_event') {
      processEvent(message)
    }
  }, [processEvent])

  const { send } = useWebSocket({ onMessage })

  const startQuery = useCallback((text: string, mode: PipelineMode) => {
    reset()
    send({ type: 'start_query', payload: { text, mode } })
  }, [send, reset])

  const nextStep = useCallback(() => {
    send({ type: 'next_step' })
  }, [send])

  const pause = useCallback(() => {
    send({ type: 'pause' })
  }, [send])

  const resume = useCallback(() => {
    send({ type: 'resume' })
  }, [send])

  const setSpeed = useCallback((speed: number) => {
    send({ type: 'set_speed', payload: { speed } })
  }, [send])

  return { startQuery, nextStep, pause, resume, setSpeed }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 6: UI Components (GlassCard, MetricBadge)

**Files:**
- Create: `frontend/src/components/ui/GlassCard.tsx`
- Create: `frontend/src/components/ui/MetricBadge.tsx`

- [ ] **Step 1: Create GlassCard**

```tsx
import { type ReactNode } from 'react'
import clsx from 'clsx'

interface GlassCardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function GlassCard({ children, className, padding = true }: GlassCardProps) {
  return (
    <div
      className={clsx(
        'glass rounded-xl',
        padding && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create MetricBadge**

```tsx
import clsx from 'clsx'

interface MetricBadgeProps {
  label: string
  value: string | number
  color?: 'blue' | 'purple' | 'emerald' | 'gold'
}

const colorMap = {
  blue: 'text-neon-blue bg-neon-blue/10 border-neon-blue/20',
  purple: 'text-neon-purple bg-neon-purple/10 border-neon-purple/20',
  emerald: 'text-neon-emerald bg-neon-emerald/10 border-neon-emerald/20',
  gold: 'text-neon-gold bg-neon-gold/10 border-neon-gold/20',
}

export function MetricBadge({ label, value, color = 'blue' }: MetricBadgeProps) {
  return (
    <div className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono', colorMap[color])}>
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 7: Layout — TopBar + App Shell

**Files:**
- Create: `frontend/src/components/layout/TopBar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create TopBar**

```tsx
import { Link, useLocation } from 'react-router-dom'
import { Settings, History, Cpu, Wifi, WifiOff } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import type { PipelineMode } from '../../types'

export function TopBar() {
  const location = useLocation()
  const { mode, setMode, wsConnected } = useUIStore()

  return (
    <header className="h-14 flex items-center justify-between px-4 glass border-b border-glass-border z-50">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <Cpu className="w-6 h-6 text-neon-blue" />
        <span className="text-lg font-semibold tracking-tight">
          RAG <span className="text-neon-blue">Viz</span>
        </span>
      </Link>

      {/* Mode Toggle (only on pipeline page) */}
      {location.pathname === '/' && (
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['step_by_step', 'dashboard'] as PipelineMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                mode === m
                  ? 'bg-neon-blue/20 text-neon-blue'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'step_by_step' ? 'Step-by-step' : 'Dashboard'}
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs">
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 text-neon-emerald" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={wsConnected ? 'text-neon-emerald' : 'text-red-400'}>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Nav links */}
        <Link
          to="/history"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <History className="w-4 h-4" />
        </Link>
        <Link
          to="/config"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update App.tsx with layout shell**

```tsx
import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'

function PipelinePage() {
  return <div className="flex-1 flex items-center justify-center text-neon-blue text-xl">Pipeline Canvas</div>
}

function HistoryPage() {
  return <div className="flex-1 flex items-center justify-center text-neon-purple text-xl">Run History</div>
}

function ConfigPage() {
  return <div className="flex-1 flex items-center justify-center text-neon-gold text-xl">Configuration</div>
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<PipelinePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — should see dark TopBar with RAG Viz logo, mode toggle, connection status, nav icons.

---

## Task 8: LeftPanel — Query Input, Doc Upload, Run History

**Files:**
- Create: `frontend/src/components/layout/LeftPanel.tsx`

- [ ] **Step 1: Create LeftPanel**

```tsx
import { useState, useRef } from 'react'
import { Send, Upload, FileText, Clock, Loader2 } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { api } from '../../services/api'
import type { DocumentInfo, PipelineMode } from '../../types'
import { useUIStore } from '../../stores/uiStore'

interface LeftPanelProps {
  onQuery: (text: string, mode: PipelineMode) => void
  documents: DocumentInfo[]
  onDocumentUploaded: () => void
}

export function LeftPanel({ onQuery, documents, onDocumentUploaded }: LeftPanelProps) {
  const [queryText, setQueryText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mode = useUIStore((s) => s.mode)

  const handleQuery = () => {
    if (!queryText.trim()) return
    onQuery(queryText.trim(), mode)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      await api.uploadDocument(file)
      onDocumentUploaded()
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <div className="w-[250px] flex flex-col gap-3 p-3 overflow-y-auto border-r border-glass-border">
      {/* Query Input */}
      <GlassCard>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Query</h3>
        <textarea
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery() } }}
          placeholder="Ask a question..."
          className="w-full bg-bg-tertiary rounded-lg p-2 text-sm text-white placeholder-gray-500 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-neon-blue/50"
        />
        <button
          onClick={handleQuery}
          disabled={!queryText.trim()}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-neon-blue/20 text-neon-blue py-1.5 rounded-lg text-sm font-medium hover:bg-neon-blue/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          Run
        </button>
      </GlassCard>

      {/* Document Upload */}
      <GlassCard>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Documents</h3>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-glass-border rounded-lg p-3 text-center cursor-pointer hover:border-neon-blue/40 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-neon-blue mx-auto animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-gray-500 mx-auto" />
          )}
          <p className="text-xs text-gray-500 mt-1">Drop or click to upload</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }}
        />
        {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}

        {/* Document list */}
        <div className="mt-2 space-y-1">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 text-xs text-gray-400 py-1">
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{doc.filename}</span>
              <span className="text-gray-600 ml-auto">{doc.num_chunks}ch</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Run History placeholder */}
      <GlassCard>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          <Clock className="w-3 h-3 inline mr-1" />
          Recent Runs
        </h3>
        <p className="text-xs text-gray-600">No runs yet</p>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 9: BottomBar — Playback Controls + Metrics

**Files:**
- Create: `frontend/src/components/layout/BottomBar.tsx`

- [ ] **Step 1: Create BottomBar**

```tsx
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react'
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

const SPEEDS = [0.5, 1, 2, 5]

export function BottomBar({ onPlay, onPause, onNextStep, onReset, onSpeedChange }: BottomBarProps) {
  const { isPlaying, speed, setIsPlaying, setSpeed, mode } = useUIStore()
  const { currentStep, totalSteps, isRunning, answer, events } = usePipelineStore()

  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  const lastLatency = events.findLast((e) => e.data.latency_ms != null)?.data.latency_ms as number | undefined
  const totalTokens = events.findLast((e) => e.data.total_tokens != null)?.data.total_tokens as number | undefined

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false)
      onPause()
    } else {
      setIsPlaying(true)
      onPlay()
    }
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    onSpeedChange(newSpeed)
  }

  return (
    <div className="h-12 flex items-center gap-4 px-4 glass border-t border-glass-border">
      {/* Playback controls (only in step-by-step) */}
      {mode === 'step_by_step' && (
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePlayPause}
            disabled={!isRunning}
            className="p-1.5 rounded-md text-neon-blue hover:bg-neon-blue/10 transition-colors disabled:opacity-40"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={onNextStep}
            disabled={!isRunning}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 ml-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
                  speed === s ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-mono w-16 text-right">
          {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Live metrics */}
      <div className="flex items-center gap-2">
        {lastLatency != null && (
          <MetricBadge label="Latency" value={`${Math.round(lastLatency)}ms`} color="blue" />
        )}
        {totalTokens != null && (
          <MetricBadge label="Tokens" value={totalTokens} color="purple" />
        )}
        {answer.length > 0 && (
          <MetricBadge label="Chars" value={answer.length} color="emerald" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 10: Pipeline Canvas — React Flow + Custom Nodes

**Files:**
- Create: `frontend/src/components/canvas/nodes/nodeConfig.ts`
- Create: `frontend/src/components/canvas/nodes/PipelineNode.tsx`
- Create: `frontend/src/components/canvas/PipelineCanvas.tsx`

- [ ] **Step 1: Create node configuration**

```typescript
import type { PipelineNodeType } from '../../../types'

export interface NodeConfig {
  id: PipelineNodeType
  label: string
  icon: string
  x: number
  y: number
  color: string
  glowClass: string
}

export const PIPELINE_NODES: NodeConfig[] = [
  // Ingestion row (top)
  { id: 'document', label: 'Document', icon: '📄', x: 0, y: 0, color: '#00d4ff', glowClass: 'glow-blue' },
  { id: 'chunking', label: 'Chunking', icon: '✂️', x: 250, y: 0, color: '#00d4ff', glowClass: 'glow-blue' },
  { id: 'embedding', label: 'Embedding', icon: '🔢', x: 500, y: 0, color: '#8b5cf6', glowClass: 'glow-purple' },
  { id: 'vectorStore', label: 'Vector Store', icon: '🗄️', x: 750, y: 0, color: '#8b5cf6', glowClass: 'glow-purple' },

  // Query row (middle)
  { id: 'queryInput', label: 'Query', icon: '💬', x: 0, y: 200, color: '#10b981', glowClass: 'glow-emerald' },
  { id: 'queryEmbed', label: 'Query Embed', icon: '🔢', x: 250, y: 200, color: '#8b5cf6', glowClass: 'glow-purple' },
  { id: 'retrieval', label: 'Retrieval', icon: '🔍', x: 750, y: 200, color: '#10b981', glowClass: 'glow-emerald' },

  // Generation column (right)
  { id: 'ranking', label: 'Ranking', icon: '📋', x: 750, y: 350, color: '#10b981', glowClass: 'glow-emerald' },
  { id: 'promptAssembly', label: 'Prompt Assembly', icon: '🧩', x: 750, y: 500, color: '#f59e0b', glowClass: 'glow-gold' },
  { id: 'generation', label: 'Generation', icon: '🤖', x: 750, y: 650, color: '#f59e0b', glowClass: 'glow-gold' },
  { id: 'response', label: 'Response', icon: '📤', x: 750, y: 800, color: '#f59e0b', glowClass: 'glow-gold' },
]

export const PIPELINE_EDGES = [
  // Ingestion flow
  { id: 'e-doc-chunk', source: 'document', target: 'chunking' },
  { id: 'e-chunk-embed', source: 'chunking', target: 'embedding' },
  { id: 'e-embed-store', source: 'embedding', target: 'vectorStore' },
  // Query flow
  { id: 'e-query-qembed', source: 'queryInput', target: 'queryEmbed' },
  { id: 'e-qembed-retrieval', source: 'queryEmbed', target: 'retrieval' },
  { id: 'e-store-retrieval', source: 'vectorStore', target: 'retrieval' },
  // Generation flow
  { id: 'e-retrieval-ranking', source: 'retrieval', target: 'ranking' },
  { id: 'e-ranking-prompt', source: 'ranking', target: 'promptAssembly' },
  { id: 'e-prompt-gen', source: 'promptAssembly', target: 'generation' },
  { id: 'e-gen-response', source: 'generation', target: 'response' },
]
```

- [ ] **Step 2: Create PipelineNode**

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { usePipelineStore } from '../../../stores/pipelineStore'
import { useUIStore } from '../../../stores/uiStore'
import type { PipelineNodeType, NodeStatus } from '../../../types'
import clsx from 'clsx'

interface PipelineNodeData {
  label: string
  icon: string
  color: string
  glowClass: string
  nodeType: PipelineNodeType
}

const statusStyles: Record<NodeStatus, string> = {
  idle: 'border-gray-700 bg-bg-secondary',
  processing: 'border-neon-blue animate-pulse-slow',
  done: 'border-neon-emerald',
  error: 'border-red-500',
}

export const PipelineNode = memo(function PipelineNode({ data }: NodeProps) {
  const nodeData = data as unknown as PipelineNodeData
  const nodeState = usePipelineStore((s) => s.nodes[nodeData.nodeType])
  const setSelectedNode = useUIStore((s) => s.setSelectedNode)
  const selectedNode = useUIStore((s) => s.selectedNode)

  const isSelected = selectedNode === nodeData.nodeType
  const status = nodeState?.status ?? 'idle'

  return (
    <div
      onClick={() => setSelectedNode(nodeData.nodeType)}
      className={clsx(
        'px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 min-w-[140px]',
        'bg-bg-secondary/80 backdrop-blur-sm',
        statusStyles[status],
        status === 'done' && nodeData.glowClass,
        status === 'processing' && 'glow-blue',
        isSelected && 'ring-2 ring-white/30',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2">
        <span className="text-lg">{nodeData.icon}</span>
        <div>
          <div className="text-sm font-medium text-white">{nodeData.label}</div>
          {nodeState?.latencyMs != null && (
            <div className="text-xs font-mono text-gray-500">{Math.round(nodeState.latencyMs)}ms</div>
          )}
        </div>
      </div>

      {/* Status indicator dot */}
      <div className={clsx(
        'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-bg-primary',
        status === 'idle' && 'bg-gray-600',
        status === 'processing' && 'bg-neon-blue animate-ping',
        status === 'done' && 'bg-neon-emerald',
        status === 'error' && 'bg-red-500',
      )} />

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !w-2 !h-2 !border-0" />
    </div>
  )
})
```

- [ ] **Step 3: Create PipelineCanvas**

```tsx
import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PipelineNode } from './nodes/PipelineNode'
import { PIPELINE_NODES, PIPELINE_EDGES } from './nodes/nodeConfig'
import { usePipelineStore } from '../../stores/pipelineStore'
import type { NodeStatus } from '../../types'

const nodeTypes = { pipeline: PipelineNode }

const statusEdgeColors: Record<NodeStatus, string> = {
  idle: '#374151',
  processing: '#00d4ff',
  done: '#10b981',
  error: '#ef4444',
}

export function PipelineCanvas() {
  const nodes = usePipelineStore((s) => s.nodes)

  const flowNodes: Node[] = useMemo(() =>
    PIPELINE_NODES.map((cfg) => ({
      id: cfg.id,
      type: 'pipeline',
      position: { x: cfg.x, y: cfg.y },
      data: {
        label: cfg.label,
        icon: cfg.icon,
        color: cfg.color,
        glowClass: cfg.glowClass,
        nodeType: cfg.id,
      },
    })),
    [],
  )

  const flowEdges: Edge[] = useMemo(() =>
    PIPELINE_EDGES.map((cfg) => {
      const sourceNode = nodes[cfg.source as keyof typeof nodes]
      const status = sourceNode?.status ?? 'idle'
      return {
        id: cfg.id,
        source: cfg.source,
        target: cfg.target,
        animated: status === 'processing',
        style: {
          stroke: statusEdgeColors[status],
          strokeWidth: status === 'done' ? 2.5 : 1.5,
        },
      }
    }),
    [nodes],
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#1e1e2e" gap={20} size={1} />
        <MiniMap
          nodeColor="#374151"
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-bg-secondary !border-glass-border"
        />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 11: Right Panel — Detail Panels per Node Type

**Files:**
- Create: `frontend/src/components/panels/PanelRouter.tsx`
- Create: `frontend/src/components/panels/DocumentPanel.tsx`
- Create: `frontend/src/components/panels/ChunkingPanel.tsx`
- Create: `frontend/src/components/panels/RetrievalPanel.tsx`
- Create: `frontend/src/components/panels/GenerationPanel.tsx`
- Create: `frontend/src/components/panels/PromptPanel.tsx`
- Create: `frontend/src/components/panels/EmbeddingPanel.tsx`
- Create: `frontend/src/components/panels/VectorStorePanel.tsx`
- Create: `frontend/src/components/panels/RankingPanel.tsx`
- Create: `frontend/src/components/layout/RightPanel.tsx`

- [ ] **Step 1: Create individual panels**

Each panel reads from `usePipelineStore` for its node's data.

`DocumentPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function DocumentPanel() {
  const data = usePipelineStore((s) => s.nodes.document.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-blue">Document</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          {data.filename && <p>File: <span className="text-white">{data.filename as string}</span></p>}
          {data.pages && <p>Pages: <span className="text-white">{data.pages as number}</span></p>}
          {data.char_count && <p>Characters: <span className="text-white">{data.char_count as number}</span></p>}
        </div>
      </GlassCard>
    </div>
  )
}
```

`ChunkingPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function ChunkingPanel() {
  const data = usePipelineStore((s) => s.nodes.chunking.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-blue">Chunking</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          {data.num_chunks != null && <p>Chunks: <span className="text-white">{data.num_chunks as number}</span></p>}
          {data.avg_size != null && <p>Avg size: <span className="text-white">{data.avg_size as number} chars</span></p>}
          {data.strategy && <p>Strategy: <span className="text-white">{data.strategy as string}</span></p>}
        </div>
      </GlassCard>
    </div>
  )
}
```

`EmbeddingPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function EmbeddingPanel() {
  const data = usePipelineStore((s) => s.nodes.embedding.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-purple">Embedding</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          {data.vector_dim != null && <p>Dimensions: <span className="text-white">{data.vector_dim as number}</span></p>}
          {data.model && <p>Model: <span className="text-white">{data.model as string}</span></p>}
        </div>
      </GlassCard>
      <p className="text-xs text-gray-600 italic">3D visualization coming in next update</p>
    </div>
  )
}
```

`VectorStorePanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function VectorStorePanel() {
  const data = usePipelineStore((s) => s.nodes.vectorStore.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-purple">Vector Store</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          {data.collection && <p>Collection: <span className="text-white">{data.collection as string}</span></p>}
          {data.total_vectors != null && <p>Vectors: <span className="text-white">{data.total_vectors as number}</span></p>}
        </div>
      </GlassCard>
    </div>
  )
}
```

`RetrievalPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function RetrievalPanel() {
  const chunks = usePipelineStore((s) => s.chunks)
  const data = usePipelineStore((s) => s.nodes.retrieval.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-emerald">Retrieval</h3>
      {chunks.length === 0 ? (
        <p className="text-xs text-gray-600">No chunks retrieved yet</p>
      ) : (
        <div className="space-y-2">
          {chunks.map((chunk, i) => (
            <GlassCard key={chunk.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-gray-500">Chunk {i + 1}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-emerald rounded-full"
                      style={{ width: `${chunk.score * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neon-emerald">{(chunk.score * 100).toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 line-clamp-3">{chunk.text}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
```

`RankingPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function RankingPanel() {
  const data = usePipelineStore((s) => s.nodes.ranking.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-emerald">Ranking</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          <p>Status: <span className="text-white">{data.before_order ? 'Reranked' : 'Skipped'}</span></p>
        </div>
      </GlassCard>
    </div>
  )
}
```

`PromptPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'

export function PromptPanel() {
  const data = usePipelineStore((s) => s.nodes.promptAssembly.data)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-gold">Prompt Assembly</h3>
      <GlassCard>
        <div className="text-xs font-mono text-gray-400 space-y-1">
          {data.chunks_injected != null && <p>Chunks injected: <span className="text-white">{data.chunks_injected as number}</span></p>}
          {data.total_chars != null && <p>Total characters: <span className="text-white">{data.total_chars as number}</span></p>}
        </div>
      </GlassCard>
    </div>
  )
}
```

`GenerationPanel.tsx`:
```tsx
import { usePipelineStore } from '../../stores/pipelineStore'
import { GlassCard } from '../ui/GlassCard'
import { MetricBadge } from '../ui/MetricBadge'

export function GenerationPanel() {
  const { answer, tokens, nodes } = usePipelineStore()
  const data = nodes.generation.data
  const status = nodes.generation.status

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neon-gold">Generation</h3>

      <div className="flex gap-2 flex-wrap">
        {data.model && <MetricBadge label="Model" value={data.model as string} color="gold" />}
        {data.total_tokens != null && <MetricBadge label="Tokens" value={data.total_tokens as number} color="purple" />}
        {nodes.generation.latencyMs != null && <MetricBadge label="Latency" value={`${Math.round(nodes.generation.latencyMs)}ms`} color="blue" />}
      </div>

      <GlassCard>
        <div className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
          {answer || (
            <span className="text-gray-600 italic">Waiting for generation...</span>
          )}
          {status === 'processing' && (
            <span className="inline-block w-2 h-4 bg-neon-gold/60 animate-pulse ml-0.5" />
          )}
        </div>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Create PanelRouter**

```tsx
import type { PipelineNodeType } from '../../types'
import { DocumentPanel } from './DocumentPanel'
import { ChunkingPanel } from './ChunkingPanel'
import { EmbeddingPanel } from './EmbeddingPanel'
import { VectorStorePanel } from './VectorStorePanel'
import { RetrievalPanel } from './RetrievalPanel'
import { RankingPanel } from './RankingPanel'
import { PromptPanel } from './PromptPanel'
import { GenerationPanel } from './GenerationPanel'

const panelMap: Record<PipelineNodeType, () => JSX.Element> = {
  document: DocumentPanel,
  chunking: ChunkingPanel,
  embedding: EmbeddingPanel,
  vectorStore: VectorStorePanel,
  queryInput: DocumentPanel,       // reuse document panel for query display
  queryEmbed: EmbeddingPanel,      // reuse embedding panel
  retrieval: RetrievalPanel,
  ranking: RankingPanel,
  promptAssembly: PromptPanel,
  generation: GenerationPanel,
  response: GenerationPanel,       // reuse generation panel for final response
}

interface PanelRouterProps {
  nodeType: PipelineNodeType
}

export function PanelRouter({ nodeType }: PanelRouterProps) {
  const Panel = panelMap[nodeType]
  return Panel ? <Panel /> : null
}
```

- [ ] **Step 3: Create RightPanel**

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { PanelRouter } from '../panels/PanelRouter'

export function RightPanel() {
  const { rightPanelOpen, selectedNode, setSelectedNode } = useUIStore()

  return (
    <AnimatePresence>
      {rightPanelOpen && selectedNode && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="h-full border-l border-glass-border overflow-hidden"
        >
          <div className="w-[380px] h-full flex flex-col bg-bg-secondary/50 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
              <span className="text-sm font-medium text-gray-300">Node Detail</span>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4">
              <PanelRouter nodeType={selectedNode} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 12: Pipeline Page — Wire Everything Together

**Files:**
- Create: `frontend/src/pages/PipelinePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create PipelinePage**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { LeftPanel } from '../components/layout/LeftPanel'
import { RightPanel } from '../components/layout/RightPanel'
import { BottomBar } from '../components/layout/BottomBar'
import { PipelineCanvas } from '../components/canvas/PipelineCanvas'
import { usePipelineEvents } from '../hooks/usePipelineEvents'
import { usePipelineStore } from '../stores/pipelineStore'
import { api } from '../services/api'
import type { DocumentInfo, PipelineMode } from '../types'

export function PipelinePage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const { startQuery, nextStep, pause, resume, setSpeed } = usePipelineEvents()
  const reset = usePipelineStore((s) => s.reset)

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await api.listDocuments()
      setDocuments(docs)
    } catch {
      // silently fail — backend might not be running
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleQuery = useCallback((text: string, mode: PipelineMode) => {
    startQuery(text, mode)
  }, [startQuery])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  return (
    <div className="flex-1 flex overflow-hidden">
      <LeftPanel
        onQuery={handleQuery}
        documents={documents}
        onDocumentUploaded={fetchDocuments}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          <PipelineCanvas />
          <RightPanel />
        </div>
        <BottomBar
          onPlay={resume}
          onPause={pause}
          onNextStep={nextStep}
          onReset={handleReset}
          onSpeedChange={setSpeed}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx with all pages**

```tsx
import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/layout/TopBar'
import { PipelinePage } from './pages/PipelinePage'

function HistoryPage() {
  return <div className="flex-1 flex items-center justify-center text-neon-purple text-xl">Run History — Coming in next phase</div>
}

function ConfigPage() {
  return <div className="flex-1 flex items-center justify-center text-neon-gold text-xl">Configuration — Coming in next phase</div>
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<PipelinePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — should see:
- Dark TopBar with logo, mode toggle, nav
- Left panel with query input, upload zone
- Central canvas with pipeline nodes graph (React Flow)
- Bottom bar with playback controls and timeline

Click a node — right panel should slide in.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc -b --noEmit
```

---

## Task 13: Config Page

**Files:**
- Create: `frontend/src/pages/ConfigPage.tsx`
- Modify: `frontend/src/App.tsx` (import real ConfigPage)

- [ ] **Step 1: Create ConfigPage**

```tsx
import { useEffect } from 'react'
import { useProviderStore } from '../stores/providerStore'
import { GlassCard } from '../components/ui/GlassCard'
import { Check, AlertCircle, Loader2 } from 'lucide-react'

export function ConfigPage() {
  const { providers, loading, error, fetchProviders, setActiveProvider } = useProviderStore()

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
      </div>
    )
  }

  if (!providers) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Unable to load providers. Is the backend running?</p>
      </div>
    )
  }

  const sections = [
    { type: 'llm' as const, label: 'LLM Provider', color: 'text-neon-blue', data: providers.llm },
    { type: 'embedding' as const, label: 'Embedding Provider', color: 'text-neon-purple', data: providers.embedding },
    { type: 'vectordb' as const, label: 'Vector Database', color: 'text-neon-emerald', data: providers.vectordb },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Configuration</h1>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {sections.map((section) => (
        <GlassCard key={section.type}>
          <h2 className={`text-sm font-semibold ${section.color} mb-3`}>{section.label}</h2>
          <div className="space-y-2">
            {section.data.available.map((name) => (
              <button
                key={name}
                onClick={() => setActiveProvider(section.type, name)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  section.data.active === name
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="font-mono">{name}</span>
                {section.data.active === name && <Check className="w-4 h-4 text-neon-emerald" />}
              </button>
            ))}
            {section.data.available.length === 0 && (
              <p className="text-xs text-gray-600">No providers available. Check your .env configuration.</p>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx import**

Replace the inline ConfigPage with:
```tsx
import { ConfigPage } from './pages/ConfigPage'
```
And use `<ConfigPage />` in the route.

- [ ] **Step 3: Verify TypeScript compiles and check in browser**

```bash
cd frontend && npx tsc -b --noEmit
```

Navigate to http://localhost:5173/config — should show provider selection UI.

---

## Task 14: History Page

**Files:**
- Create: `frontend/src/pages/HistoryPage.tsx`
- Modify: `frontend/src/App.tsx` (import real HistoryPage)

- [ ] **Step 1: Create HistoryPage**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { GlassCard } from '../components/ui/GlassCard'
import { MetricBadge } from '../components/ui/MetricBadge'
import type { PipelineStats } from '../types'
import { BarChart3, Clock, FileText, Loader2 } from 'lucide-react'

export function HistoryPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const s = await api.getStats()
        setStats(s)
      } catch {
        // backend might not be running
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Run History</h1>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <GlassCard>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-neon-blue" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_runs}</p>
                <p className="text-xs text-gray-500">Total Runs</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-neon-purple" />
              <div>
                <p className="text-2xl font-bold text-white">{Math.round(stats.avg_latency_ms)}ms</p>
                <p className="text-xs text-gray-500">Avg Latency</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-neon-emerald" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_documents}</p>
                <p className="text-xs text-gray-500">Documents</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {stats?.total_runs === 0 && (
        <GlassCard>
          <p className="text-center text-gray-500 py-8">No runs yet. Go to the Pipeline view and run a query.</p>
        </GlassCard>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx with real HistoryPage import**

Replace inline HistoryPage:
```tsx
import { HistoryPage } from './pages/HistoryPage'
```

- [ ] **Step 3: Verify TypeScript compiles and check in browser**

```bash
cd frontend && npx tsc -b --noEmit
```

Navigate to http://localhost:5173/history — should show stats cards.

---

## Task 15: Final Verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build
```

Expected: build succeeds, output in `dist/`.

- [ ] **Step 3: Visual check in browser**

Start both backend and frontend:
```bash
# Terminal 1
cd backend && ./venv/bin/uvicorn app.main:app --port 8000

# Terminal 2
cd frontend && npm run dev
```

Verify:
1. http://localhost:5173/ — Pipeline view with canvas, left panel, bottom bar
2. Click nodes — right panel slides in with details
3. Mode toggle works (step-by-step / dashboard)
4. /config — shows available providers
5. /history — shows stats
6. Connection indicator in top bar shows Connected/Disconnected
