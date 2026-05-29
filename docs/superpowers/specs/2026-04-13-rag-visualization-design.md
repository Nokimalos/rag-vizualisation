# RAG Pipeline Visualization — Design Spec

## Overview

An interactive web application that visualizes the entire RAG (Retrieval Augmented Generation) pipeline, from document ingestion through embedding, retrieval, and generation. Serves a dual purpose: pedagogical tool for understanding RAG mechanics and monitoring/debug dashboard for real pipeline observation.

**Approach: Pipeline Canvas** — a central interactive canvas (React Flow + Three.js) representing the pipeline as a connected node graph with animated particle data flow, 3D embedding visualization, and detailed inspection panels.

---

## Architecture

### Three-layer system

1. **Frontend (React + TypeScript)** — interactive canvas, inspection panels, provider configuration
2. **API (FastAPI)** — REST endpoints for actions + WebSocket for real-time pipeline event streaming
3. **Backend modules** — Pipeline Engine (orchestration + events), Provider Manager (LLM/embedding/vectorDB abstraction), Document Processor (ingestion/chunking)

### Communication

- **REST** for CRUD operations (upload documents, list providers, get history)
- **WebSocket** for real-time streaming of pipeline events during query execution

### Data persistence

- **SQLite** for run history, events, and configuration
- **Vector DB** (configurable) for document embeddings
- **Filesystem** for uploaded documents

---

## Pipeline Canvas (core visual)

### Nodes

The pipeline is represented as a directed graph with these node types:

```
[Document] -> [Chunking] -> [Embedding] -> [Vector Store]
                                                  |
[Query Input] -> [Query Embed] -----------> [Retrieval]
                                                  |
                                           [Ranking/Scoring]
                                                  |
                                           [Prompt Assembly]
                                                  |
                                            [Generation]
                                                  |
                                             [Response]
```

Each node is a custom React Flow component with:
- **Visual state**: idle / processing / done / error — with corresponding color and animation
- **Metrics badge**: latency, token count, chunk count
- **Miniature preview**: summary of data processed at that step

### Animated edges

- **Step-by-step mode**: luminous particles flow along edges showing data movement. Color transitions: blue (raw data) -> purple (embeddings) -> green (results) -> gold (generation)
- **Dashboard mode**: edge thickness proportional to data volume
- **Color coding**: green (healthy), orange (high latency), red (error)

### Node interaction

Clicking a node opens a detail panel (slide-in from right) with content specific to each type:

| Node | Panel content |
|---|---|
| Document | Original document preview, metadata |
| Chunking | Chunk list with visual splitting overlay on original text |
| Embedding | 3D vector visualization (Three.js point cloud), dimensions, model used |
| Vector Store | Collection stats, vector count, distribution |
| Retrieval | Retrieved chunks with similarity scores, relevance bars |
| Ranking | Before/after reranking comparison, scores |
| Prompt Assembly | Full prompt sent to LLM, injected chunks highlighted |
| Generation | Streamed response, tokens/s, estimated cost |

### Two modes

- **Step-by-step**: Play/Pause/Step buttons. Each step animates, particles flow, active node pulses. Manual "Next step" to advance and inspect each stage at own pace.
- **Dashboard**: Full execution, then canvas shows final state with all metrics. Replay animation with temporal slider.

---

## Spectacular Visualizations

### 1. Embedding Space Explorer (Three.js / React Three Fiber)

Interactive 3D scene for vector space visualization:
- **3D point cloud** — each chunk as a point (reduced via UMAP/t-SNE). Proximity = semantic similarity
- **Colored clusters** — each source document has its own color, natural groupings visible
- **Query highlight** — query vector appears as a luminous sphere. Laser lines connect to K nearest chunks, intensity proportional to similarity score
- **Free orbit** — rotate, zoom, navigate 3D space with mouse
- **Hover tooltip** — hovering a point shows chunk preview

### 2. Particle Flow Engine

Animation system for data flowing through the pipeline:
- **Luminous particles** (small spheres with glow) moving along edges between nodes
- **Speed** reflects real throughput
- **Density** reflects volume (many chunks = many particles)
- **Starburst explosion** when particles reach a node, then node illuminates
- Color changes per stage: blue -> purple -> green -> gold

### 3. Token Stream Visualizer

For the generation phase:
- Tokens appear one by one with **typewriter + glow** effect
- **Lateral heatmap** shows in real-time which context chunks are most related to the current token (approximated via lexical/semantic overlap between token context window and source chunks — not actual LLM attention weights, which APIs don't expose)
- Animated tokens/second counter with sparkline graph

### 4. Chunk Similarity Matrix

Interactive **heatmap** (D3.js):
- Similarity scores between all retrieved chunks
- Chunk-to-query scores
- Clicking a cell highlights both chunks and shows text side by side

### 5. Pipeline Performance Timeline

**Horizontal timeline** (Gantt-like):
- Duration of each step as proportional bars
- Parallel steps shown when applicable
- Critical path highlighted
- Run-to-run comparison overlay

---

## Backend

### Pipeline Engine

Orchestrates execution and emits an event at each micro-step via WebSocket:

```
Query received
  |- EVENT: query_received {text, timestamp}
  |- Query Embedding
  |    \- EVENT: query_embedded {vector_dim, model, latency_ms}
  |- Vector Search
  |    \- EVENT: retrieval_done {chunks[], scores[], latency_ms}
  |- Reranking (optional — uses cross-encoder scoring via Cohere Rerank API or a local cross-encoder model from sentence-transformers)
  |    \- EVENT: reranking_done {before_order[], after_order[], scores[]}
  |- Prompt Assembly
  |    \- EVENT: prompt_assembled {template, chunks_injected, total_tokens}
  |- LLM Generation (streaming)
  |    |- EVENT: generation_start {model, temperature, max_tokens}
  |    |- EVENT: token_generated {token, index} (x N)
  |    \- EVENT: generation_done {total_tokens, latency_ms, cost_estimate}
  \- EVENT: pipeline_complete {total_latency_ms, steps_summary}
```

Events are persisted in SQLite for dashboard/history mode.

### Provider System (Strategy pattern)

Uniform abstraction for each provider type:

**LLM Providers:**
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude Sonnet, Opus)
- Ollama (Llama, Mistral — local models)

**Embedding Providers:**
- OpenAI (text-embedding-3-small/large)
- Cohere (embed-v3)
- Ollama (nomic-embed, etc.)

**Vector DB Providers:**
- ChromaDB (embedded, lightweight)
- Qdrant (Docker-based, built-in UI)
- pgvector (PostgreSQL extension)

Each provider implements a common interface. The Provider Manager handles instantiation and hot-swapping from the frontend config panel. No server restart needed.

### Document Processor

Processing pipeline with events at each stage:

1. **Parsing** — .txt/.md (direct read), .pdf (PyMuPDF), .docx (python-docx)
2. **Chunking** — configurable strategy: fixed size with overlap, recursive character splitting, semantic chunking (uses sentence embeddings to detect topic boundaries and split at natural semantic breaks)
3. **Embedding** — each chunk embedded via configured provider
4. **Indexing** — stored in configured vector DB

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Upload and ingest a document |
| `GET` | `/api/documents` | List ingested documents |
| `POST` | `/api/query` | Run a query through the pipeline |
| `GET` | `/api/query/{id}/history` | Full run history |
| `WS` | `/ws/pipeline` | WebSocket for event streaming |
| `GET` | `/api/providers` | List available and active providers |
| `PUT` | `/api/providers/config` | Hot-swap provider configuration |
| `GET` | `/api/stats` | Global metrics (runs, avg latency...) |

---

## Frontend Layout

### Main layout (4 zones)

```
+------------------------------------------------------------------+
|  Top Bar                                                          |
|  [Logo RAG Viz]   [Mode: Step-by-step | Dashboard]   [Config]    |
+--------+-----------------------------------------+----------------+
|        |                                         |                |
| Left   |          Pipeline Canvas                | Right Panel    |
| Panel  |          (React Flow)                   | (Detail)       |
|        |                                         |                |
| Query  |   Node graph with animated              | Dynamic        |
| Input  |   particles and glow effects            | content per    |
|        |                                         | selected node  |
| Doc    |                                         |                |
| Upload |                                         |                |
|        |                                         |                |
| Run    |                                         |                |
| History|                                         |                |
+--------+--------------------+--------------------+----------------+
|  Bottom Bar                 |                                     |
|  [Play] [Pause] [Next]     |  Timeline + live metrics            |
+-----------------------------+-------------------------------------+
```

**Left Panel (~250px):** Query input, document upload (drag & drop), run history, active provider badges.

**Pipeline Canvas (center, expandable):** React Flow graph with nodes and particles. Zoom, pan, minimap. Dark grid background with depth gradient.

**Right Panel (slide-in, ~400px, closed by default):** Opens on node click. Dynamic content per node type. Tabs for multiple views. Detachable as floating window.

**Bottom Bar:** Play/Pause/Step controls, speed slider (0.5x-5x), progress timeline, live metrics (latency, tokens, cost).

### Routes

| Route | View | Description |
|---|---|---|
| `/` | Pipeline Canvas | Main view with interactive canvas |
| `/embeddings` | Embedding Explorer | Full-screen 3D vector space |
| `/history` | Run History | All runs table with filters and comparison |
| `/config` | Configuration | Provider management, chunking params |

### Visual theme

- **Dark mode** default (background `#0a0a0f` to `#12121a`)
- Neon palette: electric blue (`#00d4ff`), purple (`#8b5cf6`), emerald (`#10b981`), gold (`#f59e0b`)
- **Glow/bloom** effects on active nodes and particles
- Monospace typography for technical data (tokens, vectors), sans-serif elsewhere
- Subtle glassmorphism on panels (semi-transparent background + blur)

---

## WebSocket Protocol

### Client -> Server

```json
{ "type": "start_query", "payload": { "text": "...", "mode": "step_by_step" } }
{ "type": "next_step" }
{ "type": "pause" }
{ "type": "resume" }
{ "type": "set_speed", "payload": { "speed": 2 } }
```

### Server -> Client

```json
{ "type": "pipeline_event", "event": "query_received", "data": {}, "step": 1, "total_steps": 8, "timestamp": "..." }
{ "type": "pipeline_event", "event": "token_generated", "data": { "token": "Le", "index": 0 } }
{ "type": "error", "event": "step_failed", "data": { "step": "embedding", "error": "...", "recoverable": true } }
{ "type": "pipeline_complete", "data": { "summary": {} } }
```

**Step-by-step mode:** Server sends one event then waits for `next_step` (unless play is active, then auto-sends at configured speed).

**Dashboard mode:** Server sends all events at once after pipeline completion.

---

## Error Handling

| Situation | Behavior |
|---|---|
| Provider not configured | Node grayed out with warning icon, click opens config panel |
| API error (timeout, rate limit) | Node turns red, pulses, error message in detail panel |
| Unparseable document | Toast notification + error detail in Document node panel |
| WebSocket connection lost | Top banner "Reconnecting..." with exponential backoff retry |
| No relevant chunks found | Retrieval node shows empty state with suggestions (rephrase query, adjust threshold) |

---

## Configuration Panel

Accessible via top bar gear icon or `/config` route:

- **LLM Provider**: provider selector, model, temperature slider, max tokens
- **Embedding Provider**: provider selector, model, dimensions
- **Vector DB**: backend selector, collection
- **Chunking Strategy**: strategy selector, chunk size slider, overlap slider, live preview ("With these settings, your 5000-word document yields ~23 chunks")
- **Retrieval**: top K slider, similarity threshold slider, reranking toggle
- **API Keys**: stored server-side in `.env`, frontend shows only configured/missing status with input field

All changes applied hot (no restart).

---

## Tech Stack

### Frontend

| Library | Usage |
|---|---|
| React 18+ | UI framework |
| TypeScript 5+ | Type safety |
| Vite 5+ | Build tool, dev server |
| React Flow 11+ | Pipeline node canvas |
| React Three Fiber 8+ | 3D scenes (embeddings, particles) |
| Three.js 0.160+ | 3D engine |
| @react-three/drei 9+ | R3F helpers (OrbitControls, Effects) |
| @react-three/postprocessing 2+ | Bloom, glow, unreal bloom |
| Framer Motion 11+ | UI animations (panels, transitions) |
| D3.js 7+ | Heatmaps, similarity matrix |
| Recharts 2+ | Metrics charts |
| TailwindCSS 3+ | Utility styling |
| Zustand 4+ | State management |
| React Router 6+ | Routing |
| Lucide React | Icons |

### Backend

| Library | Usage |
|---|---|
| FastAPI | REST API + WebSocket |
| Uvicorn | ASGI server |
| Pydantic | Data validation |
| SQLite + aiosqlite | Run/event persistence |
| PyMuPDF (fitz) | PDF parsing |
| python-docx | DOCX parsing |
| tiktoken | Token counting |
| numpy | Vector operations |
| umap-learn | Dimension reduction for 3D visualization |
| scikit-learn | t-SNE alternative, similarity metrics |
| openai | OpenAI SDK (LLM + embeddings) |
| anthropic | Anthropic SDK (Claude) |
| ollama | Ollama client (local models) |
| chromadb | Embedded vector DB |
| qdrant-client | Qdrant client |
| psycopg2 + pgvector | PostgreSQL + pgvector client |

---

## Project Structure

```
rag_vizualisation/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/           # Pipeline canvas (React Flow)
│   │   │   │   ├── PipelineCanvas.tsx
│   │   │   │   ├── nodes/        # Custom nodes per step type
│   │   │   │   ├── edges/        # Custom animated edges + particles
│   │   │   │   └── controls/     # Play/Pause/Step controls
│   │   │   ├── panels/           # Detail panels (right panel)
│   │   │   │   ├── ChunkingPanel.tsx
│   │   │   │   ├── EmbeddingPanel.tsx
│   │   │   │   ├── RetrievalPanel.tsx
│   │   │   │   ├── GenerationPanel.tsx
│   │   │   │   └── ...
│   │   │   ├── three/            # 3D components
│   │   │   │   ├── EmbeddingSpace.tsx
│   │   │   │   ├── ParticleFlow.tsx
│   │   │   │   └── effects/      # Bloom, glow shaders
│   │   │   ├── viz/              # D3/Recharts visualizations
│   │   │   │   ├── SimilarityMatrix.tsx
│   │   │   │   ├── PerformanceTimeline.tsx
│   │   │   │   └── TokenStream.tsx
│   │   │   ├── sidebar/          # Left panel
│   │   │   ├── config/           # Config panel
│   │   │   └── ui/               # Reusable components
│   │   ├── stores/               # Zustand stores
│   │   │   ├── pipelineStore.ts  # Pipeline state
│   │   │   ├── providerStore.ts  # Provider config
│   │   │   └── uiStore.ts       # UI state (panels, mode...)
│   │   ├── hooks/                # Custom hooks
│   │   │   ├── useWebSocket.ts   # WS connection to backend
│   │   │   ├── usePipelineEvents.ts
│   │   │   └── useAnimation.ts
│   │   ├── services/             # API client
│   │   │   └── api.ts
│   │   ├── types/                # TypeScript types
│   │   ├── pages/                # Route views
│   │   └── App.tsx
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app + startup
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── documents.py  # Upload, list
│   │   │   │   ├── query.py      # Run a query
│   │   │   │   ├── providers.py  # Provider config
│   │   │   │   └── stats.py      # Metrics
│   │   │   └── websocket.py      # WS pipeline events
│   │   ├── core/
│   │   │   ├── pipeline.py       # Pipeline engine
│   │   │   ├── events.py         # Event system
│   │   │   └── config.py         # App config
│   │   ├── providers/
│   │   │   ├── llm/
│   │   │   ├── embedding/
│   │   │   └── vectordb/
│   │   ├── processing/
│   │   │   ├── parser.py         # Document parsing
│   │   │   ├── chunker.py        # Chunking strategies
│   │   │   └── embedder.py       # Embedding orchestration
│   │   ├── models/               # Pydantic models
│   │   └── db/                   # SQLite persistence
│   ├── requirements.txt
│   └── pyproject.toml
│
├── docs/
└── README.md
```
