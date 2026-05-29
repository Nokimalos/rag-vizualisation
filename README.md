# RAG Pipeline Visualization

[![CI](https://github.com/Nokimalos/rag-vizualisation/actions/workflows/ci.yml/badge.svg)](https://github.com/Nokimalos/rag-vizualisation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An interactive web application that visualizes the entire **RAG (Retrieval-Augmented Generation)** pipeline — from document ingestion through chunking, embedding, retrieval, and generation — in real time.

It serves a dual purpose:

- **Pedagogical tool** — understand how RAG actually works, step by step.
- **Monitoring / debug dashboard** — observe a real pipeline executing, with live metrics and 3D embedding exploration.

The pipeline is rendered as an interactive node graph (React Flow) with animated particle data-flow, a Three.js 3D embedding-space explorer, and detailed inspection panels for every stage.

---

## Features

- **Pipeline canvas** — `Document → Chunking → Embedding → Vector Store → Retrieval → Ranking → Prompt → Generation` as a live, animated graph.
- **3D embedding space explorer** — chunks projected via UMAP into a navigable Three.js point cloud; the query vector and its nearest neighbours are highlighted.
- **Real-time streaming** — pipeline events stream over WebSocket as a query runs; tokens appear with a live tokens/s counter.
- **Inspection panels** — per-node detail views: chunk splitting, similarity scores, assembled prompt, generation stream, and more.
- **Visualizations** — chunk similarity matrix, performance timeline, relevance bars, token stream.
- **Multi-provider, swappable at runtime:**
  - **LLM:** OpenAI, Anthropic, Ollama, vLLM (OpenAI-compatible)
  - **Embeddings:** OpenAI, Cohere, Ollama
  - **Vector DB:** ChromaDB (built-in, default); Qdrant and Postgres/pgvector register automatically when configured
- **Document ingestion** — PDF (incl. OCR via Tesseract), DOCX, plain text, and codebase import.

---

## Tech stack

| Layer    | Technologies |
|----------|--------------|
| Frontend | React 18, TypeScript, Vite, Three.js / React Three Fiber, React Flow (`@xyflow/react`), D3, Recharts, Framer Motion, Zustand, Tailwind CSS |
| Backend  | Python 3.11+, FastAPI, Uvicorn, Pydantic, WebSockets, SQLite (aiosqlite) |
| ML / Viz | NumPy, scikit-learn, UMAP, tiktoken |
| Infra    | Docker, Docker Compose, nginx, Ollama |

---

## Quick start (Docker Compose)

The fastest way to run the whole stack — frontend, backend, and a local Ollama instance.

```bash
# 1. Configure backend secrets (optional — Ollama works with no API keys)
cp backend/.env.example backend/.env
#   edit backend/.env to add OPENAI_API_KEY / ANTHROPIC_API_KEY / COHERE_API_KEY if you have them

# 2. Build & start
docker compose up --build

# 3. Pull an embedding model into Ollama (first run only)
docker exec -it ollama ollama pull nomic-embed-text
```

- Frontend: <http://localhost:3000>
- Backend API + docs: <http://localhost:8090/docs>

> The backend runs fully offline with Ollama. API keys for OpenAI/Anthropic/Cohere are only needed if you want to use those providers.

---

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # configure providers

uvicorn app.main:app --reload --port 8090
```

API docs (Swagger UI): <http://localhost:8090/docs>

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev                    # http://localhost:5173
```

The Vite dev server proxies API/WebSocket calls to the backend on port 8090.

---

## Configuration

Backend settings are read from `backend/.env` (see [`backend/.env.example`](backend/.env.example)):

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI LLM + embeddings | — |
| `ANTHROPIC_API_KEY` | Anthropic LLM | — |
| `COHERE_API_KEY` | Cohere embeddings | — |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | `http://localhost:11434` |
| `VLLM_BASE_URL` / `VLLM_MODEL` | vLLM (OpenAI-compatible) endpoint | — |
| `CHROMA_PERSIST_DIR` | ChromaDB storage path | `./data/chroma` |
| `QDRANT_URL` | Qdrant endpoint (registers Qdrant when set) | — |
| `PGVECTOR_CONNECTION_STRING` | Postgres/pgvector connection (registers pgvector when set) | — |
| `VECTOR_DIM` | Embedding dimension for Qdrant/pgvector collections | `1536` |
| `UPLOAD_DIR` | Uploaded documents directory | `./uploads` |
| `DATABASE_URL` | SQLite database path | `./data/rag_viz.db` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |

Providers are auto-registered at startup based on which keys are present; Ollama is always available as a fallback.

---

## API overview

REST endpoints (prefixed `/api`) plus a WebSocket stream:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents/upload` | Upload a document (PDF/DOCX/TXT) |
| `POST` | `/api/documents/upload-codebase` | Import a codebase |
| `GET`  | `/api/documents` | List ingested documents |
| `POST` | `/api/query` | Run a RAG query through the pipeline |
| `GET`  | `/api/embeddings/3d` | UMAP-projected 3D embedding coordinates |
| `GET`  | `/api/providers` · `PUT` `/api/providers/config` | Inspect / switch active providers |
| `GET`  | `/api/stats` · `/api/stats/runs` | Pipeline run history & metrics |
| `WS`   | `/ws/pipeline` | Real-time pipeline event stream |

Full interactive documentation is available at `/docs` when the backend is running.

---

## Testing

```bash
cd backend
pytest                         # 20 test modules: unit + integration

cd frontend
npm run lint                   # oxlint (fails on any warning)
npm test                       # vitest (stores & hooks)
npm run build                  # type-check + production build
```

---

## Project structure

```
.
├── backend/                   # FastAPI service
│   └── app/
│       ├── api/               # REST routes + WebSocket
│       ├── core/              # config, pipeline engine, event emitter
│       ├── db/                # SQLite persistence
│       ├── processing/        # parsing, chunking, embedding
│       ├── providers/         # LLM / embedding / vectordb abstractions
│       └── models/            # Pydantic schemas
├── frontend/                  # React + Vite app
│   └── src/
│       ├── components/        # canvas, three, viz, panels, layout, ui
│       ├── pages/ hooks/ stores/ services/
├── docs/                      # design spec & implementation plans
├── sample_docs/               # example document to ingest
└── docker-compose.yml
```

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup and
the checks to run before opening a PR. Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Kaan Bouldoires
