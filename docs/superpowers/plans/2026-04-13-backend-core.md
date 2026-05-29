# Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend for the RAG pipeline visualization app — FastAPI server with REST + WebSocket, configurable multi-provider system (LLM, embedding, vector DB), document processor, pipeline engine with event streaming, and SQLite persistence.

**Architecture:** FastAPI app with 3 core modules: Provider Manager (Strategy pattern for LLM/embedding/vectorDB hot-swapping), Document Processor (parsing + chunking + embedding), and Pipeline Engine (orchestrates query execution and emits events via WebSocket). All modules communicate through a typed event system persisted in SQLite.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, aiosqlite, PyMuPDF, python-docx, tiktoken, numpy, umap-learn, openai, anthropic, ollama, chromadb, qdrant-client

---

## File Structure

```
backend/
├── pyproject.toml
├── requirements.txt
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, startup, CORS, mount routes
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py              # Settings via pydantic-settings, .env loading
│   │   └── events.py              # EventEmitter, PipelineEvent types
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # All Pydantic request/response/event schemas
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── manager.py             # ProviderManager: registry + hot-swap
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── base.py            # Abstract LLMProvider
│   │   │   ├── openai_llm.py      # OpenAI GPT implementation
│   │   │   ├── anthropic_llm.py   # Anthropic Claude implementation
│   │   │   └── ollama_llm.py      # Ollama local models implementation
│   │   ├── embedding/
│   │   │   ├── __init__.py
│   │   │   ├── base.py            # Abstract EmbeddingProvider
│   │   │   ├── openai_embed.py    # OpenAI embeddings implementation
│   │   │   ├── cohere_embed.py    # Cohere embeddings implementation
│   │   │   └── ollama_embed.py    # Ollama embeddings implementation
│   │   └── vectordb/
│   │       ├── __init__.py
│   │       ├── base.py            # Abstract VectorDBProvider
│   │       ├── chroma_db.py       # ChromaDB implementation
│   │       ├── qdrant_db.py       # Qdrant implementation
│   │       └── pgvector_db.py     # pgvector implementation
│   ├── processing/
│   │   ├── __init__.py
│   │   ├── parser.py              # Document parsing (.txt, .md, .pdf, .docx)
│   │   ├── chunker.py             # Chunking strategies (fixed, recursive, semantic)
│   │   └── embedder.py            # Embedding orchestration for document ingestion
│   ├── db/
│   │   ├── __init__.py
│   │   └── database.py            # SQLite async layer (runs, events, documents)
│   └── api/
│       ├── __init__.py
│       ├── websocket.py           # WebSocket handler for pipeline event streaming
│       └── routes/
│           ├── __init__.py
│           ├── documents.py       # POST /upload, GET /documents
│           ├── query.py           # POST /query, GET /query/{id}/history
│           ├── providers.py       # GET /providers, PUT /providers/config
│           └── stats.py           # GET /stats
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # Shared fixtures (test client, mock providers)
│   ├── test_config.py
│   ├── test_events.py
│   ├── test_schemas.py
│   ├── test_provider_manager.py
│   ├── test_llm_providers.py
│   ├── test_embedding_providers.py
│   ├── test_vectordb_providers.py
│   ├── test_parser.py
│   ├── test_chunker.py
│   ├── test_embedder.py
│   ├── test_database.py
│   ├── test_pipeline.py
│   ├── test_api_documents.py
│   ├── test_api_query.py
│   ├── test_api_providers.py
│   ├── test_api_stats.py
│   └── test_websocket.py
└── uploads/                       # Document upload directory (gitignored)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "rag-vizualisation-backend"
version = "0.1.0"
description = "Backend for RAG Pipeline Visualization"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
pydantic==2.*
pydantic-settings==2.*
aiosqlite==0.20.*
python-multipart==0.0.*
websockets==13.*

# Document processing
PyMuPDF==1.25.*
python-docx==1.1.*
tiktoken==0.8.*

# ML / Vector
numpy==2.*
umap-learn==0.5.*
scikit-learn==1.6.*

# LLM Providers
openai==1.*
anthropic==0.42.*
ollama==0.4.*

# Embedding Providers
cohere==5.*

# Vector DB
chromadb==0.6.*
qdrant-client==1.13.*

# Testing
pytest==8.*
pytest-asyncio==0.24.*
httpx==0.28.*
```

- [ ] **Step 3: Create .env.example**

```env
# LLM Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# Embedding Providers
COHERE_API_KEY=

# Vector DB
CHROMA_PERSIST_DIR=./data/chroma
QDRANT_URL=http://localhost:6333
PGVECTOR_CONNECTION_STRING=

# App
UPLOAD_DIR=./uploads
DATABASE_URL=./data/rag_viz.db
```

- [ ] **Step 4: Create minimal FastAPI app**

Create `backend/app/__init__.py` (empty file).

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="RAG Pipeline Visualization",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Install dependencies and verify**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 6: Run and verify health endpoint**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
# In another terminal:
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "chore: scaffold backend project with FastAPI and dependencies"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/schemas.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write tests for schemas**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/test_schemas.py`:

```python
import pytest
from app.models.schemas import (
    PipelineEvent,
    PipelineEventType,
    QueryRequest,
    QueryResponse,
    DocumentInfo,
    ProviderConfig,
    ProviderType,
    ChunkingStrategy,
    ChunkingConfig,
    RetrievalConfig,
    PipelineRunSummary,
    StepSummary,
)


class TestPipelineEvent:
    def test_create_event(self):
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED,
            step=1,
            total_steps=8,
            data={"text": "What is RAG?"},
        )
        assert event.type == PipelineEventType.QUERY_RECEIVED
        assert event.step == 1
        assert event.timestamp is not None

    def test_event_serialization(self):
        event = PipelineEvent(
            type=PipelineEventType.TOKEN_GENERATED,
            step=7,
            total_steps=8,
            data={"token": "Hello", "index": 0},
        )
        data = event.model_dump()
        assert data["type"] == "token_generated"
        assert data["data"]["token"] == "Hello"


class TestQueryRequest:
    def test_valid_request(self):
        req = QueryRequest(text="What is RAG?", mode="step_by_step")
        assert req.text == "What is RAG?"
        assert req.mode == "step_by_step"

    def test_default_mode(self):
        req = QueryRequest(text="What is RAG?")
        assert req.mode == "dashboard"


class TestProviderConfig:
    def test_llm_config(self):
        config = ProviderConfig(
            provider_type=ProviderType.LLM,
            provider_name="openai",
            model="gpt-4o",
            settings={"temperature": 0.7, "max_tokens": 2048},
        )
        assert config.provider_name == "openai"
        assert config.settings["temperature"] == 0.7


class TestChunkingConfig:
    def test_default_values(self):
        config = ChunkingConfig()
        assert config.strategy == ChunkingStrategy.RECURSIVE
        assert config.chunk_size == 512
        assert config.overlap == 50

    def test_custom_values(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED,
            chunk_size=1024,
            overlap=100,
        )
        assert config.chunk_size == 1024


class TestRetrievalConfig:
    def test_default_values(self):
        config = RetrievalConfig()
        assert config.top_k == 5
        assert config.similarity_threshold == 0.7
        assert config.reranking_enabled is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.schemas'`

- [ ] **Step 3: Implement schemas**

Create `backend/app/models/__init__.py` (empty file).

Create `backend/app/models/schemas.py`:

```python
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# --- Enums ---

class PipelineEventType(str, Enum):
    QUERY_RECEIVED = "query_received"
    QUERY_EMBEDDED = "query_embedded"
    RETRIEVAL_DONE = "retrieval_done"
    RERANKING_DONE = "reranking_done"
    PROMPT_ASSEMBLED = "prompt_assembled"
    GENERATION_START = "generation_start"
    TOKEN_GENERATED = "token_generated"
    GENERATION_DONE = "generation_done"
    PIPELINE_COMPLETE = "pipeline_complete"
    DOCUMENT_RECEIVED = "document_received"
    DOCUMENT_PARSED = "document_parsed"
    CHUNKING_DONE = "chunking_done"
    CHUNK_EMBEDDED = "chunk_embedded"
    INDEXING_DONE = "indexing_done"
    STEP_FAILED = "step_failed"


class ProviderType(str, Enum):
    LLM = "llm"
    EMBEDDING = "embedding"
    VECTORDB = "vectordb"


class ChunkingStrategy(str, Enum):
    FIXED = "fixed"
    RECURSIVE = "recursive"
    SEMANTIC = "semantic"


# --- Events ---

class PipelineEvent(BaseModel):
    type: PipelineEventType
    step: int
    total_steps: int
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- API Request/Response ---

class QueryRequest(BaseModel):
    text: str
    mode: str = "dashboard"  # "step_by_step" or "dashboard"


class QueryResponse(BaseModel):
    run_id: str
    status: str
    answer: str | None = None
    total_latency_ms: float | None = None


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    num_chunks: int = 0
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Provider Config ---

class ProviderConfig(BaseModel):
    provider_type: ProviderType
    provider_name: str
    model: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)


# --- Chunking & Retrieval Config ---

class ChunkingConfig(BaseModel):
    strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE
    chunk_size: int = 512
    overlap: int = 50


class RetrievalConfig(BaseModel):
    top_k: int = 5
    similarity_threshold: float = 0.7
    reranking_enabled: bool = False


# --- Pipeline Run Summary ---

class StepSummary(BaseModel):
    name: str
    latency_ms: float
    status: str  # "success" or "error"
    data: dict[str, Any] = Field(default_factory=dict)


class PipelineRunSummary(BaseModel):
    run_id: str
    query: str
    answer: str | None = None
    total_latency_ms: float
    steps: list[StepSummary] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add Pydantic schemas for events, providers, and API"
```

---

## Task 3: Configuration Management

**Files:**
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 1: Write tests for config**

Create `backend/tests/test_config.py`:

```python
import os
import pytest
from app.core.config import Settings


class TestSettings:
    def test_default_values(self):
        settings = Settings(
            _env_file=None,
            UPLOAD_DIR="./uploads",
            DATABASE_URL="./data/test.db",
        )
        assert settings.UPLOAD_DIR == "./uploads"
        assert settings.DATABASE_URL == "./data/test.db"
        assert settings.CHROMA_PERSIST_DIR == "./data/chroma"

    def test_api_key_detection(self):
        settings = Settings(
            _env_file=None,
            OPENAI_API_KEY="sk-test-123",
            UPLOAD_DIR="./uploads",
            DATABASE_URL="./data/test.db",
        )
        assert settings.has_api_key("openai") is True
        assert settings.has_api_key("anthropic") is False

    def test_all_provider_keys(self):
        settings = Settings(
            _env_file=None,
            OPENAI_API_KEY="sk-test",
            ANTHROPIC_API_KEY="sk-ant-test",
            COHERE_API_KEY="co-test",
            UPLOAD_DIR="./uploads",
            DATABASE_URL="./data/test.db",
        )
        available = settings.available_providers()
        assert "openai" in available
        assert "anthropic" in available
        assert "cohere" in available
        assert "ollama" in available  # always available (local)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_config.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.config'`

- [ ] **Step 3: Implement config**

Create `backend/app/core/__init__.py` (empty file).

Create `backend/app/core/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Embedding Providers
    COHERE_API_KEY: str = ""

    # Vector DB
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    QDRANT_URL: str = "http://localhost:6333"
    PGVECTOR_CONNECTION_STRING: str = ""

    # App
    UPLOAD_DIR: str = "./uploads"
    DATABASE_URL: str = "./data/rag_viz.db"

    model_config = {"env_file": ".env", "extra": "ignore"}

    def has_api_key(self, provider: str) -> bool:
        key_map = {
            "openai": self.OPENAI_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "cohere": self.COHERE_API_KEY,
        }
        return bool(key_map.get(provider, ""))

    def available_providers(self) -> list[str]:
        providers = ["ollama"]  # always available (local)
        for name in ["openai", "anthropic", "cohere"]:
            if self.has_api_key(name):
                providers.append(name)
        return providers


settings = Settings()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_config.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/ backend/tests/test_config.py
git commit -m "feat: add configuration management with pydantic-settings"
```

---

## Task 4: Event System

**Files:**
- Create: `backend/app/core/events.py`
- Create: `backend/tests/test_events.py`

- [ ] **Step 1: Write tests for event system**

Create `backend/tests/test_events.py`:

```python
import asyncio
import pytest
from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType


class TestEventEmitter:
    @pytest.fixture
    def emitter(self):
        return EventEmitter()

    @pytest.mark.asyncio
    async def test_subscribe_and_emit(self, emitter):
        received = []

        async def handler(event: PipelineEvent):
            received.append(event)

        emitter.subscribe(handler)
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED,
            step=1,
            total_steps=8,
            data={"text": "test"},
        )
        await emitter.emit(event)
        assert len(received) == 1
        assert received[0].type == PipelineEventType.QUERY_RECEIVED

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, emitter):
        received_a = []
        received_b = []

        async def handler_a(event: PipelineEvent):
            received_a.append(event)

        async def handler_b(event: PipelineEvent):
            received_b.append(event)

        emitter.subscribe(handler_a)
        emitter.subscribe(handler_b)
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED,
            step=1,
            total_steps=8,
        )
        await emitter.emit(event)
        assert len(received_a) == 1
        assert len(received_b) == 1

    @pytest.mark.asyncio
    async def test_unsubscribe(self, emitter):
        received = []

        async def handler(event: PipelineEvent):
            received.append(event)

        emitter.subscribe(handler)
        emitter.unsubscribe(handler)
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED,
            step=1,
            total_steps=8,
        )
        await emitter.emit(event)
        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_event_history(self, emitter):
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED,
            step=1,
            total_steps=8,
        )
        await emitter.emit(event)
        assert len(emitter.history) == 1

    def test_clear_history(self, emitter):
        emitter.history.append("fake_event")
        emitter.clear_history()
        assert len(emitter.history) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_events.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.events'`

- [ ] **Step 3: Implement event system**

Create `backend/app/core/events.py`:

```python
from typing import Callable, Awaitable
from app.models.schemas import PipelineEvent

EventHandler = Callable[[PipelineEvent], Awaitable[None]]


class EventEmitter:
    def __init__(self):
        self._handlers: list[EventHandler] = []
        self.history: list[PipelineEvent] = []

    def subscribe(self, handler: EventHandler) -> None:
        self._handlers.append(handler)

    def unsubscribe(self, handler: EventHandler) -> None:
        self._handlers = [h for h in self._handlers if h is not handler]

    async def emit(self, event: PipelineEvent) -> None:
        self.history.append(event)
        for handler in self._handlers:
            await handler(event)

    def clear_history(self) -> None:
        self.history.clear()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_events.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/events.py backend/tests/test_events.py
git commit -m "feat: add async event emitter for pipeline event broadcasting"
```

---

## Task 5: LLM Provider Interface + OpenAI Implementation

**Files:**
- Create: `backend/app/providers/__init__.py`
- Create: `backend/app/providers/llm/__init__.py`
- Create: `backend/app/providers/llm/base.py`
- Create: `backend/app/providers/llm/openai_llm.py`
- Create: `backend/tests/test_llm_providers.py`

- [ ] **Step 1: Write tests for LLM base and OpenAI provider**

Create `backend/tests/test_llm_providers.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.providers.llm.base import LLMProvider
from app.providers.llm.openai_llm import OpenAILLMProvider


class TestLLMProviderInterface:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            LLMProvider()

    def test_interface_methods_exist(self):
        assert hasattr(LLMProvider, "generate")
        assert hasattr(LLMProvider, "generate_stream")
        assert hasattr(LLMProvider, "name")


class TestOpenAILLMProvider:
    def test_provider_name(self):
        provider = OpenAILLMProvider(api_key="sk-test", model="gpt-4o")
        assert provider.name() == "openai"

    def test_default_model(self):
        provider = OpenAILLMProvider(api_key="sk-test")
        assert provider.model == "gpt-4o"

    @pytest.mark.asyncio
    async def test_generate(self):
        provider = OpenAILLMProvider(api_key="sk-test", model="gpt-4o")

        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "RAG stands for Retrieval Augmented Generation."
        mock_response.choices = [mock_choice]
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 8
        mock_response.usage.total_tokens = 18

        with patch.object(
            provider._client.chat.completions,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.generate(
                prompt="What is RAG?",
                temperature=0.7,
                max_tokens=2048,
            )
            assert result["content"] == "RAG stands for Retrieval Augmented Generation."
            assert result["usage"]["total_tokens"] == 18

    @pytest.mark.asyncio
    async def test_generate_stream(self):
        provider = OpenAILLMProvider(api_key="sk-test", model="gpt-4o")

        async def mock_stream():
            for token in ["Hello", " world", "!"]:
                chunk = MagicMock()
                chunk.choices = [MagicMock()]
                chunk.choices[0].delta.content = token
                yield chunk

        with patch.object(
            provider._client.chat.completions,
            "create",
            new_callable=AsyncMock,
            return_value=mock_stream(),
        ):
            tokens = []
            async for token in provider.generate_stream(
                prompt="Say hello",
                temperature=0.7,
                max_tokens=100,
            ):
                tokens.append(token)
            assert tokens == ["Hello", " world", "!"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_llm_providers.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement LLM base interface**

Create `backend/app/providers/__init__.py` (empty file).
Create `backend/app/providers/llm/__init__.py` (empty file).

Create `backend/app/providers/llm/base.py`:

```python
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator


class LLMProvider(ABC):
    @abstractmethod
    def name(self) -> str:
        """Return provider name identifier."""
        ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        """Generate a complete response. Returns dict with 'content' and 'usage'."""
        ...

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens one by one. Yields token strings."""
        ...
```

- [ ] **Step 4: Implement OpenAI LLM provider**

Create `backend/app/providers/llm/openai_llm.py`:

```python
from typing import Any, AsyncGenerator
from openai import AsyncOpenAI
from app.providers.llm.base import LLMProvider


class OpenAILLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key)

    def name(self) -> str:
        return "openai"

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {
            "content": response.choices[0].message.content,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
        }

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_llm_providers.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/providers/ backend/tests/test_llm_providers.py
git commit -m "feat: add LLM provider interface and OpenAI implementation"
```

---

## Task 6: Anthropic + Ollama LLM Providers

**Files:**
- Create: `backend/app/providers/llm/anthropic_llm.py`
- Create: `backend/app/providers/llm/ollama_llm.py`
- Modify: `backend/tests/test_llm_providers.py`

- [ ] **Step 1: Write tests for Anthropic and Ollama providers**

Add to `backend/tests/test_llm_providers.py`:

```python
from app.providers.llm.anthropic_llm import AnthropicLLMProvider
from app.providers.llm.ollama_llm import OllamaLLMProvider


class TestAnthropicLLMProvider:
    def test_provider_name(self):
        provider = AnthropicLLMProvider(api_key="sk-ant-test", model="claude-sonnet-4-20250514")
        assert provider.name() == "anthropic"

    def test_default_model(self):
        provider = AnthropicLLMProvider(api_key="sk-ant-test")
        assert provider.model == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_generate(self):
        provider = AnthropicLLMProvider(api_key="sk-ant-test")

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="RAG is a technique.")]
        mock_response.usage.input_tokens = 10
        mock_response.usage.output_tokens = 6

        with patch.object(
            provider._client.messages,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.generate(prompt="What is RAG?")
            assert result["content"] == "RAG is a technique."
            assert result["usage"]["total_tokens"] == 16

    @pytest.mark.asyncio
    async def test_generate_stream(self):
        provider = AnthropicLLMProvider(api_key="sk-ant-test")

        class MockStreamManager:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def __aiter__(self):
                for token in ["Hello", " from", " Claude"]:
                    event = MagicMock()
                    event.type = "content_block_delta"
                    event.delta.text = token
                    yield event

        with patch.object(
            provider._client.messages,
            "stream",
            return_value=MockStreamManager(),
        ):
            tokens = []
            async for token in provider.generate_stream(prompt="Say hello"):
                tokens.append(token)
            assert tokens == ["Hello", " from", " Claude"]


class TestOllamaLLMProvider:
    def test_provider_name(self):
        provider = OllamaLLMProvider(model="llama3.1")
        assert provider.name() == "ollama"

    def test_default_model(self):
        provider = OllamaLLMProvider()
        assert provider.model == "llama3.1"

    @pytest.mark.asyncio
    async def test_generate(self):
        provider = OllamaLLMProvider(model="llama3.1")

        mock_response = {
            "message": {"content": "RAG explained."},
            "prompt_eval_count": 10,
            "eval_count": 5,
        }

        with patch.object(
            provider._client,
            "chat",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.generate(prompt="What is RAG?")
            assert result["content"] == "RAG explained."
            assert result["usage"]["total_tokens"] == 15

    @pytest.mark.asyncio
    async def test_generate_stream(self):
        provider = OllamaLLMProvider(model="llama3.1")

        async def mock_stream():
            for token in ["Local", " model", " response"]:
                yield {"message": {"content": token}}

        with patch.object(
            provider._client,
            "chat",
            return_value=mock_stream(),
        ):
            tokens = []
            async for token in provider.generate_stream(prompt="Say hello"):
                tokens.append(token)
            assert tokens == ["Local", " model", " response"]
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd backend
python -m pytest tests/test_llm_providers.py -v -k "Anthropic or Ollama"
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement Anthropic LLM provider**

Create `backend/app/providers/llm/anthropic_llm.py`:

```python
from typing import Any, AsyncGenerator
from anthropic import AsyncAnthropic
from app.providers.llm.base import LLMProvider


class AnthropicLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.model = model
        self._client = AsyncAnthropic(api_key=api_key)

    def name(self) -> str:
        return "anthropic"

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = await self._client.messages.create(**kwargs)
        return {
            "content": response.content[0].text,
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            },
        }

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        async with self._client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    yield event.delta.text
```

- [ ] **Step 4: Implement Ollama LLM provider**

Create `backend/app/providers/llm/ollama_llm.py`:

```python
from typing import Any, AsyncGenerator
from ollama import AsyncClient
from app.providers.llm.base import LLMProvider


class OllamaLLMProvider(LLMProvider):
    def __init__(
        self,
        model: str = "llama3.1",
        base_url: str = "http://localhost:11434",
    ):
        self.model = model
        self._client = AsyncClient(host=base_url)

    def name(self) -> str:
        return "ollama"

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self._client.chat(
            model=self.model,
            messages=messages,
            options={"temperature": temperature, "num_predict": max_tokens},
        )
        return {
            "content": response["message"]["content"],
            "usage": {
                "prompt_tokens": response.get("prompt_eval_count", 0),
                "completion_tokens": response.get("eval_count", 0),
                "total_tokens": response.get("prompt_eval_count", 0)
                + response.get("eval_count", 0),
            },
        }

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self._client.chat(
            model=self.model,
            messages=messages,
            options={"temperature": temperature, "num_predict": max_tokens},
            stream=True,
        )
        async for chunk in stream:
            if chunk["message"]["content"]:
                yield chunk["message"]["content"]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_llm_providers.py -v
```

Expected: All 13 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/providers/llm/ backend/tests/test_llm_providers.py
git commit -m "feat: add Anthropic and Ollama LLM providers"
```

---

## Task 7: Embedding Provider Interface + All Implementations

**Files:**
- Create: `backend/app/providers/embedding/__init__.py`
- Create: `backend/app/providers/embedding/base.py`
- Create: `backend/app/providers/embedding/openai_embed.py`
- Create: `backend/app/providers/embedding/cohere_embed.py`
- Create: `backend/app/providers/embedding/ollama_embed.py`
- Create: `backend/tests/test_embedding_providers.py`

- [ ] **Step 1: Write tests for all embedding providers**

Create `backend/tests/test_embedding_providers.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.providers.embedding.base import EmbeddingProvider
from app.providers.embedding.openai_embed import OpenAIEmbeddingProvider
from app.providers.embedding.cohere_embed import CohereEmbeddingProvider
from app.providers.embedding.ollama_embed import OllamaEmbeddingProvider


class TestEmbeddingProviderInterface:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            EmbeddingProvider()


class TestOpenAIEmbeddingProvider:
    def test_provider_name(self):
        provider = OpenAIEmbeddingProvider(api_key="sk-test")
        assert provider.name() == "openai"

    def test_default_model(self):
        provider = OpenAIEmbeddingProvider(api_key="sk-test")
        assert provider.model == "text-embedding-3-small"

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = OpenAIEmbeddingProvider(api_key="sk-test")

        mock_response = MagicMock()
        mock_embedding_1 = MagicMock()
        mock_embedding_1.embedding = [0.1, 0.2, 0.3]
        mock_embedding_2 = MagicMock()
        mock_embedding_2.embedding = [0.4, 0.5, 0.6]
        mock_response.data = [mock_embedding_1, mock_embedding_2]
        mock_response.usage.total_tokens = 10

        with patch.object(
            provider._client.embeddings,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.embed(["hello", "world"])
            assert len(result["embeddings"]) == 2
            assert result["embeddings"][0] == [0.1, 0.2, 0.3]
            assert result["usage"]["total_tokens"] == 10

    @pytest.mark.asyncio
    async def test_embed_query(self):
        provider = OpenAIEmbeddingProvider(api_key="sk-test")

        mock_response = MagicMock()
        mock_embedding = MagicMock()
        mock_embedding.embedding = [0.1, 0.2, 0.3]
        mock_response.data = [mock_embedding]
        mock_response.usage.total_tokens = 5

        with patch.object(
            provider._client.embeddings,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.embed_query("hello")
            assert result["embedding"] == [0.1, 0.2, 0.3]


class TestCohereEmbeddingProvider:
    def test_provider_name(self):
        provider = CohereEmbeddingProvider(api_key="co-test")
        assert provider.name() == "cohere"

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = CohereEmbeddingProvider(api_key="co-test")

        mock_response = MagicMock()
        mock_response.embeddings.float_ = [[0.1, 0.2], [0.3, 0.4]]
        mock_response.meta.billed_units.input_tokens = 8

        with patch.object(
            provider._client,
            "embed",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.embed(["hello", "world"])
            assert len(result["embeddings"]) == 2


class TestOllamaEmbeddingProvider:
    def test_provider_name(self):
        provider = OllamaEmbeddingProvider()
        assert provider.name() == "ollama"

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = OllamaEmbeddingProvider(model="nomic-embed-text")

        mock_response = {"embeddings": [[0.1, 0.2], [0.3, 0.4]]}

        with patch.object(
            provider._client,
            "embed",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await provider.embed(["hello", "world"])
            assert len(result["embeddings"]) == 2
            assert result["embeddings"][0] == [0.1, 0.2]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_embedding_providers.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement embedding base interface**

Create `backend/app/providers/embedding/__init__.py` (empty file).

Create `backend/app/providers/embedding/base.py`:

```python
from abc import ABC, abstractmethod
from typing import Any


class EmbeddingProvider(ABC):
    @abstractmethod
    def name(self) -> str:
        """Return provider name identifier."""
        ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> dict[str, Any]:
        """Embed multiple texts. Returns dict with 'embeddings' (list of vectors) and 'usage'."""
        ...

    @abstractmethod
    async def embed_query(self, text: str) -> dict[str, Any]:
        """Embed a single query. Returns dict with 'embedding' (single vector) and 'usage'."""
        ...

    @abstractmethod
    def dimensions(self) -> int:
        """Return the embedding dimension count."""
        ...
```

- [ ] **Step 4: Implement OpenAI embedding provider**

Create `backend/app/providers/embedding/openai_embed.py`:

```python
from typing import Any
from openai import AsyncOpenAI
from app.providers.embedding.base import EmbeddingProvider

MODEL_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key)

    def name(self) -> str:
        return "openai"

    def dimensions(self) -> int:
        return MODEL_DIMENSIONS.get(self.model, 1536)

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self._client.embeddings.create(
            model=self.model,
            input=texts,
        )
        return {
            "embeddings": [item.embedding for item in response.data],
            "usage": {"total_tokens": response.usage.total_tokens},
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        result = await self.embed([text])
        return {
            "embedding": result["embeddings"][0],
            "usage": result["usage"],
        }
```

- [ ] **Step 5: Implement Cohere embedding provider**

Create `backend/app/providers/embedding/cohere_embed.py`:

```python
from typing import Any
import cohere
from app.providers.embedding.base import EmbeddingProvider


class CohereEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = "embed-v4.0"):
        self.model = model
        self._client = cohere.AsyncClientV2(api_key=api_key)

    def name(self) -> str:
        return "cohere"

    def dimensions(self) -> int:
        return 1024

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self._client.embed(
            texts=texts,
            model=self.model,
            input_type="search_document",
            embedding_types=["float"],
        )
        return {
            "embeddings": response.embeddings.float_,
            "usage": {
                "total_tokens": getattr(
                    response.meta.billed_units, "input_tokens", 0
                )
            },
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        response = await self._client.embed(
            texts=[text],
            model=self.model,
            input_type="search_query",
            embedding_types=["float"],
        )
        return {
            "embedding": response.embeddings.float_[0],
            "usage": {
                "total_tokens": getattr(
                    response.meta.billed_units, "input_tokens", 0
                )
            },
        }
```

- [ ] **Step 6: Implement Ollama embedding provider**

Create `backend/app/providers/embedding/ollama_embed.py`:

```python
from typing import Any
from ollama import AsyncClient
from app.providers.embedding.base import EmbeddingProvider


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434",
    ):
        self.model = model
        self._client = AsyncClient(host=base_url)

    def name(self) -> str:
        return "ollama"

    def dimensions(self) -> int:
        return 768  # default for nomic-embed-text

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self._client.embed(
            model=self.model,
            input=texts,
        )
        return {
            "embeddings": response["embeddings"],
            "usage": {"total_tokens": 0},  # Ollama doesn't report token usage
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        result = await self.embed([text])
        return {
            "embedding": result["embeddings"][0],
            "usage": result["usage"],
        }
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_embedding_providers.py -v
```

Expected: All 9 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/providers/embedding/ backend/tests/test_embedding_providers.py
git commit -m "feat: add embedding provider interface with OpenAI, Cohere, Ollama"
```

---

## Task 8: VectorDB Provider Interface + All Implementations

**Files:**
- Create: `backend/app/providers/vectordb/__init__.py`
- Create: `backend/app/providers/vectordb/base.py`
- Create: `backend/app/providers/vectordb/chroma_db.py`
- Create: `backend/app/providers/vectordb/qdrant_db.py`
- Create: `backend/app/providers/vectordb/pgvector_db.py`
- Create: `backend/tests/test_vectordb_providers.py`

- [ ] **Step 1: Write tests for VectorDB base and ChromaDB**

Create `backend/tests/test_vectordb_providers.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.providers.vectordb.base import VectorDBProvider, SearchResult
from app.providers.vectordb.chroma_db import ChromaDBProvider


class TestVectorDBProviderInterface:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            VectorDBProvider()

    def test_search_result_model(self):
        result = SearchResult(
            chunk_id="chunk_1",
            text="Hello world",
            score=0.95,
            metadata={"source": "test.txt"},
        )
        assert result.score == 0.95


class TestChromaDBProvider:
    def test_provider_name(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_chroma.PersistentClient.return_value = MagicMock()
            provider = ChromaDBProvider(persist_dir="./test_data")
            assert provider.name() == "chromadb"

    @pytest.mark.asyncio
    async def test_create_collection(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            provider = ChromaDBProvider(persist_dir="./test_data")

            await provider.create_collection("test_col")
            mock_client.get_or_create_collection.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_documents(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_collection = MagicMock()
            mock_client.get_or_create_collection.return_value = mock_collection
            mock_chroma.PersistentClient.return_value = mock_client
            provider = ChromaDBProvider(persist_dir="./test_data")
            await provider.create_collection("test_col")

            await provider.add_documents(
                collection="test_col",
                ids=["id1", "id2"],
                texts=["hello", "world"],
                embeddings=[[0.1, 0.2], [0.3, 0.4]],
                metadatas=[{"source": "a"}, {"source": "b"}],
            )
            mock_collection.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_search(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_collection = MagicMock()
            mock_collection.query.return_value = {
                "ids": [["id1", "id2"]],
                "documents": [["hello", "world"]],
                "distances": [[0.1, 0.3]],
                "metadatas": [[{"source": "a"}, {"source": "b"}]],
            }
            mock_client.get_or_create_collection.return_value = mock_collection
            mock_chroma.PersistentClient.return_value = mock_client
            provider = ChromaDBProvider(persist_dir="./test_data")
            await provider.create_collection("test_col")

            results = await provider.search(
                collection="test_col",
                query_embedding=[0.1, 0.2],
                top_k=2,
            )
            assert len(results) == 2
            assert results[0].chunk_id == "id1"
            assert results[0].score == pytest.approx(0.9)  # 1 - distance

    @pytest.mark.asyncio
    async def test_get_stats(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_collection = MagicMock()
            mock_collection.count.return_value = 42
            mock_client.get_or_create_collection.return_value = mock_collection
            mock_chroma.PersistentClient.return_value = mock_client
            provider = ChromaDBProvider(persist_dir="./test_data")
            await provider.create_collection("test_col")

            stats = await provider.get_stats("test_col")
            assert stats["total_vectors"] == 42
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_vectordb_providers.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement VectorDB base interface**

Create `backend/app/providers/vectordb/__init__.py` (empty file).

Create `backend/app/providers/vectordb/base.py`:

```python
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, Any] = {}


class VectorDBProvider(ABC):
    @abstractmethod
    def name(self) -> str:
        """Return provider name identifier."""
        ...

    @abstractmethod
    async def create_collection(self, collection: str) -> None:
        """Create or get a collection."""
        ...

    @abstractmethod
    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        """Add documents with embeddings to a collection."""
        ...

    @abstractmethod
    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        """Search for similar documents. Returns list of SearchResult sorted by score desc."""
        ...

    @abstractmethod
    async def delete_collection(self, collection: str) -> None:
        """Delete a collection."""
        ...

    @abstractmethod
    async def get_stats(self, collection: str) -> dict[str, Any]:
        """Get collection statistics."""
        ...
```

- [ ] **Step 4: Implement ChromaDB provider**

Create `backend/app/providers/vectordb/chroma_db.py`:

```python
from typing import Any
import chromadb
from app.providers.vectordb.base import VectorDBProvider, SearchResult


class ChromaDBProvider(VectorDBProvider):
    def __init__(self, persist_dir: str = "./data/chroma"):
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._collections: dict[str, Any] = {}

    def name(self) -> str:
        return "chromadb"

    async def create_collection(self, collection: str) -> None:
        self._collections[collection] = self._client.get_or_create_collection(
            name=collection,
            metadata={"hnsw:space": "cosine"},
        )

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        col = self._collections[collection]
        col.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        col = self._collections[collection]
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "distances", "metadatas"],
        )
        search_results = []
        for i in range(len(results["ids"][0])):
            search_results.append(
                SearchResult(
                    chunk_id=results["ids"][0][i],
                    text=results["documents"][0][i],
                    score=1.0 - results["distances"][0][i],  # cosine distance to similarity
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {},
                )
            )
        return search_results

    async def delete_collection(self, collection: str) -> None:
        self._client.delete_collection(name=collection)
        self._collections.pop(collection, None)

    async def get_stats(self, collection: str) -> dict[str, Any]:
        col = self._collections[collection]
        return {
            "collection": collection,
            "total_vectors": col.count(),
        }
```

- [ ] **Step 5: Implement Qdrant provider**

Create `backend/app/providers/vectordb/qdrant_db.py`:

```python
from typing import Any
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
)
from app.providers.vectordb.base import VectorDBProvider, SearchResult


class QdrantDBProvider(VectorDBProvider):
    def __init__(self, url: str = "http://localhost:6333", vector_size: int = 1536):
        self._client = AsyncQdrantClient(url=url)
        self._vector_size = vector_size

    def name(self) -> str:
        return "qdrant"

    async def create_collection(self, collection: str) -> None:
        collections = await self._client.get_collections()
        existing = [c.name for c in collections.collections]
        if collection not in existing:
            await self._client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(
                    size=self._vector_size,
                    distance=Distance.COSINE,
                ),
            )

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        points = []
        for i, (doc_id, text, embedding) in enumerate(zip(ids, texts, embeddings)):
            payload = {"text": text}
            if metadatas and i < len(metadatas):
                payload.update(metadatas[i])
            points.append(
                PointStruct(
                    id=i,
                    vector=embedding,
                    payload=payload,
                )
            )
        await self._client.upsert(collection_name=collection, points=points)

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        results = await self._client.query_points(
            collection_name=collection,
            query=query_embedding,
            limit=top_k,
            with_payload=True,
        )
        search_results = []
        for point in results.points:
            search_results.append(
                SearchResult(
                    chunk_id=str(point.id),
                    text=point.payload.get("text", ""),
                    score=point.score,
                    metadata={
                        k: v for k, v in point.payload.items() if k != "text"
                    },
                )
            )
        return search_results

    async def delete_collection(self, collection: str) -> None:
        await self._client.delete_collection(collection_name=collection)

    async def get_stats(self, collection: str) -> dict[str, Any]:
        info = await self._client.get_collection(collection_name=collection)
        return {
            "collection": collection,
            "total_vectors": info.points_count,
        }
```

- [ ] **Step 6: Implement pgvector provider**

Create `backend/app/providers/vectordb/pgvector_db.py`:

```python
from typing import Any
import json
import numpy as np

from app.providers.vectordb.base import VectorDBProvider, SearchResult

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None


class PgvectorDBProvider(VectorDBProvider):
    def __init__(self, connection_string: str, vector_size: int = 1536):
        if psycopg2 is None:
            raise ImportError("psycopg2 is required for pgvector support")
        self._conn_str = connection_string
        self._vector_size = vector_size
        self._conn = psycopg2.connect(connection_string)
        self._conn.autocommit = True
        with self._conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

    def name(self) -> str:
        return "pgvector"

    async def create_collection(self, collection: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {collection} (
                    id TEXT PRIMARY KEY,
                    text TEXT,
                    embedding vector({self._vector_size}),
                    metadata JSONB DEFAULT '{{}}'
                )
            """)

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        with self._conn.cursor() as cur:
            for i, (doc_id, text, embedding) in enumerate(
                zip(ids, texts, embeddings)
            ):
                metadata = json.dumps(
                    metadatas[i] if metadatas and i < len(metadatas) else {}
                )
                cur.execute(
                    f"""
                    INSERT INTO {collection} (id, text, embedding, metadata)
                    VALUES (%s, %s, %s::vector, %s::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        text = EXCLUDED.text,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata
                    """,
                    (doc_id, text, str(embedding), metadata),
                )

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, text, 1 - (embedding <=> %s::vector) as score, metadata
                FROM {collection}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (str(query_embedding), str(query_embedding), top_k),
            )
            results = []
            for row in cur.fetchall():
                results.append(
                    SearchResult(
                        chunk_id=row[0],
                        text=row[1],
                        score=float(row[2]),
                        metadata=row[3] if row[3] else {},
                    )
                )
            return results

    async def delete_collection(self, collection: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {collection}")

    async def get_stats(self, collection: str) -> dict[str, Any]:
        with self._conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {collection}")
            count = cur.fetchone()[0]
            return {
                "collection": collection,
                "total_vectors": count,
            }
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_vectordb_providers.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/providers/vectordb/ backend/tests/test_vectordb_providers.py
git commit -m "feat: add VectorDB provider interface with ChromaDB, Qdrant, pgvector"
```

---

## Task 9: Provider Manager

**Files:**
- Create: `backend/app/providers/manager.py`
- Create: `backend/tests/test_provider_manager.py`

- [ ] **Step 1: Write tests for Provider Manager**

Create `backend/tests/test_provider_manager.py`:

```python
import pytest
from unittest.mock import MagicMock, AsyncMock
from app.providers.manager import ProviderManager
from app.providers.llm.base import LLMProvider
from app.providers.embedding.base import EmbeddingProvider
from app.providers.vectordb.base import VectorDBProvider


class MockLLM(LLMProvider):
    def name(self): return "mock_llm"
    async def generate(self, prompt, **kwargs): return {"content": "mock", "usage": {}}
    async def generate_stream(self, prompt, **kwargs):
        yield "mock"


class MockEmbedding(EmbeddingProvider):
    def name(self): return "mock_embed"
    async def embed(self, texts): return {"embeddings": [[0.1]], "usage": {}}
    async def embed_query(self, text): return {"embedding": [0.1], "usage": {}}
    def dimensions(self): return 3


class MockVectorDB(VectorDBProvider):
    def name(self): return "mock_vdb"
    async def create_collection(self, collection): pass
    async def add_documents(self, **kwargs): pass
    async def search(self, **kwargs): return []
    async def delete_collection(self, collection): pass
    async def get_stats(self, collection): return {}


class TestProviderManager:
    def test_register_and_get_llm(self):
        manager = ProviderManager()
        mock = MockLLM()
        manager.register_llm("mock_llm", mock)
        manager.set_active_llm("mock_llm")
        assert manager.get_llm().name() == "mock_llm"

    def test_register_and_get_embedding(self):
        manager = ProviderManager()
        mock = MockEmbedding()
        manager.register_embedding("mock_embed", mock)
        manager.set_active_embedding("mock_embed")
        assert manager.get_embedding().name() == "mock_embed"

    def test_register_and_get_vectordb(self):
        manager = ProviderManager()
        mock = MockVectorDB()
        manager.register_vectordb("mock_vdb", mock)
        manager.set_active_vectordb("mock_vdb")
        assert manager.get_vectordb().name() == "mock_vdb"

    def test_get_unset_provider_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="No active LLM provider"):
            manager.get_llm()

    def test_set_unknown_provider_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            manager.set_active_llm("nonexistent")

    def test_hot_swap(self):
        manager = ProviderManager()
        mock1 = MockLLM()
        mock2 = MockLLM()
        mock2.name = lambda: "mock_llm_2"
        manager.register_llm("llm1", mock1)
        manager.register_llm("llm2", mock2)
        manager.set_active_llm("llm1")
        assert manager.get_llm().name() == "mock_llm"
        manager.set_active_llm("llm2")
        assert manager.get_llm().name() == "mock_llm_2"

    def test_list_providers(self):
        manager = ProviderManager()
        manager.register_llm("llm1", MockLLM())
        manager.register_embedding("embed1", MockEmbedding())
        manager.register_vectordb("vdb1", MockVectorDB())
        info = manager.list_providers()
        assert "llm1" in info["llm"]["available"]
        assert "embed1" in info["embedding"]["available"]
        assert "vdb1" in info["vectordb"]["available"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_provider_manager.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement Provider Manager**

Create `backend/app/providers/manager.py`:

```python
from typing import Any
from app.providers.llm.base import LLMProvider
from app.providers.embedding.base import EmbeddingProvider
from app.providers.vectordb.base import VectorDBProvider


class ProviderManager:
    def __init__(self):
        self._llm_providers: dict[str, LLMProvider] = {}
        self._embedding_providers: dict[str, EmbeddingProvider] = {}
        self._vectordb_providers: dict[str, VectorDBProvider] = {}
        self._active_llm: str | None = None
        self._active_embedding: str | None = None
        self._active_vectordb: str | None = None

    # --- Registration ---

    def register_llm(self, name: str, provider: LLMProvider) -> None:
        self._llm_providers[name] = provider

    def register_embedding(self, name: str, provider: EmbeddingProvider) -> None:
        self._embedding_providers[name] = provider

    def register_vectordb(self, name: str, provider: VectorDBProvider) -> None:
        self._vectordb_providers[name] = provider

    # --- Active setters ---

    def set_active_llm(self, name: str) -> None:
        if name not in self._llm_providers:
            raise ValueError(f"Unknown LLM provider: {name}")
        self._active_llm = name

    def set_active_embedding(self, name: str) -> None:
        if name not in self._embedding_providers:
            raise ValueError(f"Unknown embedding provider: {name}")
        self._active_embedding = name

    def set_active_vectordb(self, name: str) -> None:
        if name not in self._vectordb_providers:
            raise ValueError(f"Unknown vectordb provider: {name}")
        self._active_vectordb = name

    # --- Active getters ---

    def get_llm(self) -> LLMProvider:
        if not self._active_llm:
            raise ValueError("No active LLM provider. Configure one first.")
        return self._llm_providers[self._active_llm]

    def get_embedding(self) -> EmbeddingProvider:
        if not self._active_embedding:
            raise ValueError("No active embedding provider. Configure one first.")
        return self._embedding_providers[self._active_embedding]

    def get_vectordb(self) -> VectorDBProvider:
        if not self._active_vectordb:
            raise ValueError("No active vectordb provider. Configure one first.")
        return self._vectordb_providers[self._active_vectordb]

    # --- Introspection ---

    def list_providers(self) -> dict[str, Any]:
        return {
            "llm": {
                "available": list(self._llm_providers.keys()),
                "active": self._active_llm,
            },
            "embedding": {
                "available": list(self._embedding_providers.keys()),
                "active": self._active_embedding,
            },
            "vectordb": {
                "available": list(self._vectordb_providers.keys()),
                "active": self._active_vectordb,
            },
        }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_provider_manager.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/manager.py backend/tests/test_provider_manager.py
git commit -m "feat: add ProviderManager with registration and hot-swap"
```

---

## Task 10: Document Parser

**Files:**
- Create: `backend/app/processing/__init__.py`
- Create: `backend/app/processing/parser.py`
- Create: `backend/tests/test_parser.py`

- [ ] **Step 1: Write tests for document parser**

Create `backend/tests/test_parser.py`:

```python
import os
import tempfile
import pytest
from app.processing.parser import DocumentParser, ParseResult


class TestDocumentParser:
    def test_parse_txt(self, tmp_path):
        file_path = tmp_path / "test.txt"
        file_path.write_text("Hello, this is a test document.\nWith two lines.")

        result = DocumentParser.parse(str(file_path))
        assert result.text == "Hello, this is a test document.\nWith two lines."
        assert result.file_type == "txt"
        assert result.char_count == 47
        assert result.page_count == 1

    def test_parse_md(self, tmp_path):
        file_path = tmp_path / "test.md"
        file_path.write_text("# Title\n\nSome **markdown** content.")

        result = DocumentParser.parse(str(file_path))
        assert "# Title" in result.text
        assert result.file_type == "md"

    def test_parse_unsupported_format(self, tmp_path):
        file_path = tmp_path / "test.xyz"
        file_path.write_text("content")

        with pytest.raises(ValueError, match="Unsupported file type"):
            DocumentParser.parse(str(file_path))

    def test_parse_nonexistent_file(self):
        with pytest.raises(FileNotFoundError):
            DocumentParser.parse("/nonexistent/file.txt")

    def test_supported_types(self):
        types = DocumentParser.supported_types()
        assert "txt" in types
        assert "md" in types
        assert "pdf" in types
        assert "docx" in types
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_parser.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement document parser**

Create `backend/app/processing/__init__.py` (empty file).

Create `backend/app/processing/parser.py`:

```python
import os
from dataclasses import dataclass


@dataclass
class ParseResult:
    text: str
    file_type: str
    char_count: int
    page_count: int


class DocumentParser:
    _SUPPORTED = {"txt", "md", "pdf", "docx"}

    @staticmethod
    def supported_types() -> list[str]:
        return sorted(DocumentParser._SUPPORTED)

    @staticmethod
    def parse(file_path: str) -> ParseResult:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
        if ext not in DocumentParser._SUPPORTED:
            raise ValueError(f"Unsupported file type: .{ext}")

        if ext in ("txt", "md"):
            return DocumentParser._parse_text(file_path, ext)
        elif ext == "pdf":
            return DocumentParser._parse_pdf(file_path)
        elif ext == "docx":
            return DocumentParser._parse_docx(file_path)

    @staticmethod
    def _parse_text(file_path: str, file_type: str) -> ParseResult:
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
        return ParseResult(
            text=text,
            file_type=file_type,
            char_count=len(text),
            page_count=1,
        )

    @staticmethod
    def _parse_pdf(file_path: str) -> ParseResult:
        import fitz  # PyMuPDF

        doc = fitz.open(file_path)
        pages = []
        for page in doc:
            pages.append(page.get_text())
        text = "\n".join(pages)
        page_count = len(doc)
        doc.close()
        return ParseResult(
            text=text,
            file_type="pdf",
            char_count=len(text),
            page_count=page_count,
        )

    @staticmethod
    def _parse_docx(file_path: str) -> ParseResult:
        from docx import Document

        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs]
        text = "\n".join(paragraphs)
        return ParseResult(
            text=text,
            file_type="docx",
            char_count=len(text),
            page_count=1,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_parser.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/processing/ backend/tests/test_parser.py
git commit -m "feat: add document parser for txt, md, pdf, docx"
```

---

## Task 11: Chunking Strategies

**Files:**
- Create: `backend/app/processing/chunker.py`
- Create: `backend/tests/test_chunker.py`

- [ ] **Step 1: Write tests for chunking strategies**

Create `backend/tests/test_chunker.py`:

```python
import pytest
from app.processing.chunker import Chunker, Chunk
from app.models.schemas import ChunkingStrategy


class TestFixedChunking:
    def test_basic_chunking(self):
        text = "a" * 100
        chunks = Chunker.chunk(text, strategy=ChunkingStrategy.FIXED, chunk_size=30, overlap=10)
        assert len(chunks) > 1
        assert all(isinstance(c, Chunk) for c in chunks)
        assert all(len(c.text) <= 30 for c in chunks)

    def test_overlap(self):
        text = "abcdefghijklmnopqrstuvwxyz"
        chunks = Chunker.chunk(text, strategy=ChunkingStrategy.FIXED, chunk_size=10, overlap=3)
        # First chunk ends, second chunk should start 3 chars before end of first
        assert chunks[1].text[:3] == chunks[0].text[-3:]

    def test_short_text_single_chunk(self):
        text = "Short text"
        chunks = Chunker.chunk(text, strategy=ChunkingStrategy.FIXED, chunk_size=100, overlap=10)
        assert len(chunks) == 1
        assert chunks[0].text == "Short text"

    def test_chunk_has_index(self):
        text = "a" * 100
        chunks = Chunker.chunk(text, strategy=ChunkingStrategy.FIXED, chunk_size=30, overlap=0)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i


class TestRecursiveChunking:
    def test_splits_on_paragraphs(self):
        text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
        chunks = Chunker.chunk(
            text, strategy=ChunkingStrategy.RECURSIVE, chunk_size=50, overlap=0
        )
        assert len(chunks) >= 1
        # Should try to split on paragraph boundaries
        for chunk in chunks:
            assert len(chunk.text) <= 50 or "\n\n" not in chunk.text

    def test_falls_back_to_sentences(self):
        text = "First sentence. Second sentence. Third sentence. Fourth sentence."
        chunks = Chunker.chunk(
            text, strategy=ChunkingStrategy.RECURSIVE, chunk_size=40, overlap=0
        )
        assert len(chunks) >= 2

    def test_preserves_all_content(self):
        text = "Hello world. This is a test. Of recursive chunking."
        chunks = Chunker.chunk(
            text, strategy=ChunkingStrategy.RECURSIVE, chunk_size=30, overlap=0
        )
        reconstructed = "".join(c.text for c in chunks)
        assert reconstructed.replace(" ", "") == text.replace(" ", "")


class TestChunkMetadata:
    def test_chunk_has_start_end(self):
        text = "Hello world, this is a longer test document for chunking."
        chunks = Chunker.chunk(text, strategy=ChunkingStrategy.FIXED, chunk_size=20, overlap=0)
        assert chunks[0].start_char == 0
        assert chunks[0].end_char == 20
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_chunker.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement chunking strategies**

Create `backend/app/processing/chunker.py`:

```python
from dataclasses import dataclass
from app.models.schemas import ChunkingStrategy


@dataclass
class Chunk:
    text: str
    index: int
    start_char: int
    end_char: int


class Chunker:
    @staticmethod
    def chunk(
        text: str,
        strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE,
        chunk_size: int = 512,
        overlap: int = 50,
    ) -> list[Chunk]:
        if strategy == ChunkingStrategy.FIXED:
            return Chunker._fixed_chunk(text, chunk_size, overlap)
        elif strategy == ChunkingStrategy.RECURSIVE:
            return Chunker._recursive_chunk(text, chunk_size, overlap)
        elif strategy == ChunkingStrategy.SEMANTIC:
            # Semantic chunking requires embeddings — falls back to recursive
            # for now, will be enhanced in the embedder module
            return Chunker._recursive_chunk(text, chunk_size, overlap)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

    @staticmethod
    def _fixed_chunk(text: str, chunk_size: int, overlap: int) -> list[Chunk]:
        chunks = []
        start = 0
        index = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end]
            chunks.append(
                Chunk(text=chunk_text, index=index, start_char=start, end_char=end)
            )
            index += 1
            start += chunk_size - overlap
            if start >= len(text):
                break
        return chunks

    @staticmethod
    def _recursive_chunk(text: str, chunk_size: int, overlap: int) -> list[Chunk]:
        separators = ["\n\n", "\n", ". ", " "]
        return Chunker._split_recursive(text, separators, chunk_size, overlap)

    @staticmethod
    def _split_recursive(
        text: str,
        separators: list[str],
        chunk_size: int,
        overlap: int,
    ) -> list[Chunk]:
        if len(text) <= chunk_size:
            return [Chunk(text=text, index=0, start_char=0, end_char=len(text))]

        # Find the best separator that produces splits within chunk_size
        sep = separators[0] if separators else " "
        remaining_seps = separators[1:] if len(separators) > 1 else []

        parts = text.split(sep)
        chunks = []
        current = ""
        char_offset = 0

        for i, part in enumerate(parts):
            addition = part if not current else sep + part
            if len(current) + len(addition) <= chunk_size:
                current += addition
            else:
                if current:
                    chunks.append(current)
                if len(part) > chunk_size and remaining_seps:
                    # Recurse with finer separator
                    sub_chunks = Chunker._split_recursive(
                        part, remaining_seps, chunk_size, overlap
                    )
                    for sc in sub_chunks:
                        chunks.append(sc.text)
                    current = ""
                else:
                    current = part

        if current:
            chunks.append(current)

        # Convert to Chunk objects with positions
        result = []
        pos = 0
        for i, chunk_text in enumerate(chunks):
            start = text.find(chunk_text, pos)
            if start == -1:
                start = pos
            end = start + len(chunk_text)
            result.append(
                Chunk(text=chunk_text, index=i, start_char=start, end_char=end)
            )
            pos = start + 1

        return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_chunker.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/processing/chunker.py backend/tests/test_chunker.py
git commit -m "feat: add chunking strategies (fixed, recursive)"
```

---

## Task 12: Embedding Orchestration

**Files:**
- Create: `backend/app/processing/embedder.py`
- Create: `backend/tests/test_embedder.py`

- [ ] **Step 1: Write tests for embedder**

Create `backend/tests/test_embedder.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.processing.embedder import Embedder
from app.processing.chunker import Chunk
from app.core.events import EventEmitter
from app.models.schemas import PipelineEventType


class TestEmbedder:
    @pytest.fixture
    def mock_embedding_provider(self):
        provider = MagicMock()
        provider.embed = AsyncMock(
            return_value={
                "embeddings": [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                "usage": {"total_tokens": 10},
            }
        )
        provider.dimensions.return_value = 3
        return provider

    @pytest.fixture
    def mock_vectordb_provider(self):
        provider = MagicMock()
        provider.create_collection = AsyncMock()
        provider.add_documents = AsyncMock()
        return provider

    @pytest.mark.asyncio
    async def test_embed_and_store_chunks(
        self, mock_embedding_provider, mock_vectordb_provider
    ):
        emitter = EventEmitter()
        embedder = Embedder(mock_embedding_provider, mock_vectordb_provider, emitter)

        chunks = [
            Chunk(text="Hello world", index=0, start_char=0, end_char=11),
            Chunk(text="Goodbye world", index=1, start_char=12, end_char=25),
        ]

        result = await embedder.embed_and_store(
            chunks=chunks,
            document_id="doc_1",
            collection="test_col",
        )

        assert result["num_embedded"] == 2
        assert result["dimensions"] == 3
        mock_embedding_provider.embed.assert_called_once()
        mock_vectordb_provider.add_documents.assert_called_once()

    @pytest.mark.asyncio
    async def test_emits_events(
        self, mock_embedding_provider, mock_vectordb_provider
    ):
        emitter = EventEmitter()
        received_events = []

        async def handler(event):
            received_events.append(event)

        emitter.subscribe(handler)
        embedder = Embedder(mock_embedding_provider, mock_vectordb_provider, emitter)

        chunks = [
            Chunk(text="Hello", index=0, start_char=0, end_char=5),
        ]

        # Need to adjust mock for single chunk
        mock_embedding_provider.embed = AsyncMock(
            return_value={
                "embeddings": [[0.1, 0.2, 0.3]],
                "usage": {"total_tokens": 5},
            }
        )

        await embedder.embed_and_store(
            chunks=chunks,
            document_id="doc_1",
            collection="test_col",
        )

        event_types = [e.type for e in received_events]
        assert PipelineEventType.CHUNK_EMBEDDED in event_types
        assert PipelineEventType.INDEXING_DONE in event_types
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_embedder.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement embedder**

Create `backend/app/processing/embedder.py`:

```python
import uuid
from typing import Any
from app.processing.chunker import Chunk
from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType
from app.providers.embedding.base import EmbeddingProvider
from app.providers.vectordb.base import VectorDBProvider


class Embedder:
    def __init__(
        self,
        embedding_provider: EmbeddingProvider,
        vectordb_provider: VectorDBProvider,
        emitter: EventEmitter,
    ):
        self._embedding = embedding_provider
        self._vectordb = vectordb_provider
        self._emitter = emitter

    async def embed_and_store(
        self,
        chunks: list[Chunk],
        document_id: str,
        collection: str,
    ) -> dict[str, Any]:
        # Ensure collection exists
        await self._vectordb.create_collection(collection)

        # Embed all chunks
        texts = [chunk.text for chunk in chunks]
        embed_result = await self._embedding.embed(texts)
        embeddings = embed_result["embeddings"]

        # Emit per-chunk events
        for i, chunk in enumerate(chunks):
            await self._emitter.emit(
                PipelineEvent(
                    type=PipelineEventType.CHUNK_EMBEDDED,
                    step=0,  # will be set by pipeline engine
                    total_steps=0,
                    data={
                        "chunk_id": f"{document_id}_chunk_{chunk.index}",
                        "chunk_index": chunk.index,
                        "vector_dim": len(embeddings[i]),
                    },
                )
            )

        # Store in vector DB
        ids = [f"{document_id}_chunk_{chunk.index}" for chunk in chunks]
        metadatas = [
            {
                "document_id": document_id,
                "chunk_index": chunk.index,
                "start_char": chunk.start_char,
                "end_char": chunk.end_char,
            }
            for chunk in chunks
        ]

        await self._vectordb.add_documents(
            collection=collection,
            ids=ids,
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        await self._emitter.emit(
            PipelineEvent(
                type=PipelineEventType.INDEXING_DONE,
                step=0,
                total_steps=0,
                data={
                    "collection": collection,
                    "total_vectors": len(chunks),
                    "dimensions": self._embedding.dimensions(),
                },
            )
        )

        return {
            "num_embedded": len(chunks),
            "dimensions": self._embedding.dimensions(),
            "usage": embed_result["usage"],
        }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_embedder.py -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/processing/embedder.py backend/tests/test_embedder.py
git commit -m "feat: add embedding orchestration with event emission"
```

---

## Task 13: SQLite Database Layer

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write tests for database layer**

Create `backend/tests/test_database.py`:

```python
import os
import pytest
from app.db.database import Database


@pytest.fixture
async def db(tmp_path):
    db_path = str(tmp_path / "test.db")
    database = Database(db_path)
    await database.initialize()
    yield database
    await database.close()


class TestDatabase:
    @pytest.mark.asyncio
    async def test_initialize_creates_tables(self, db):
        tables = await db.fetch_all(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        table_names = [t["name"] for t in tables]
        assert "pipeline_runs" in table_names
        assert "pipeline_events" in table_names
        assert "documents" in table_names

    @pytest.mark.asyncio
    async def test_save_and_get_document(self, db):
        await db.save_document(
            doc_id="doc_1",
            filename="test.txt",
            file_type="txt",
            size_bytes=100,
            num_chunks=5,
        )
        doc = await db.get_document("doc_1")
        assert doc["filename"] == "test.txt"
        assert doc["num_chunks"] == 5

    @pytest.mark.asyncio
    async def test_list_documents(self, db):
        await db.save_document("d1", "a.txt", "txt", 100, 5)
        await db.save_document("d2", "b.pdf", "pdf", 200, 10)
        docs = await db.list_documents()
        assert len(docs) == 2

    @pytest.mark.asyncio
    async def test_save_and_get_run(self, db):
        await db.save_run(
            run_id="run_1",
            query="What is RAG?",
        )
        run = await db.get_run("run_1")
        assert run["query"] == "What is RAG?"
        assert run["status"] == "running"

    @pytest.mark.asyncio
    async def test_update_run(self, db):
        await db.save_run(run_id="run_1", query="test")
        await db.update_run(
            run_id="run_1",
            status="completed",
            answer="RAG is...",
            total_latency_ms=1234.5,
        )
        run = await db.get_run("run_1")
        assert run["status"] == "completed"
        assert run["answer"] == "RAG is..."

    @pytest.mark.asyncio
    async def test_save_and_get_events(self, db):
        await db.save_run(run_id="run_1", query="test")
        await db.save_event(
            run_id="run_1",
            event_type="query_received",
            step=1,
            total_steps=8,
            data={"text": "test"},
        )
        await db.save_event(
            run_id="run_1",
            event_type="query_embedded",
            step=2,
            total_steps=8,
            data={"vector_dim": 1536},
        )
        events = await db.get_run_events("run_1")
        assert len(events) == 2
        assert events[0]["event_type"] == "query_received"

    @pytest.mark.asyncio
    async def test_get_stats(self, db):
        await db.save_run("r1", "q1")
        await db.update_run("r1", status="completed", total_latency_ms=100.0)
        await db.save_run("r2", "q2")
        await db.update_run("r2", status="completed", total_latency_ms=200.0)
        stats = await db.get_stats()
        assert stats["total_runs"] == 2
        assert stats["avg_latency_ms"] == 150.0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_database.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement database layer**

Create `backend/app/db/__init__.py` (empty file).

Create `backend/app/db/database.py`:

```python
import json
from datetime import datetime, timezone
from typing import Any
import aiosqlite


class Database:
    def __init__(self, db_path: str):
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        self._db = await aiosqlite.connect(self._db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                num_chunks INTEGER DEFAULT 0,
                uploaded_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                answer TEXT,
                total_latency_ms REAL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pipeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                step INTEGER NOT NULL,
                total_steps INTEGER NOT NULL,
                data TEXT DEFAULT '{}',
                timestamp TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
            );
        """)

    async def close(self) -> None:
        if self._db:
            await self._db.close()

    async def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
        async with self._db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    # --- Documents ---

    async def save_document(
        self,
        doc_id: str,
        filename: str,
        file_type: str,
        size_bytes: int,
        num_chunks: int,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._db.execute(
            "INSERT INTO documents (id, filename, file_type, size_bytes, num_chunks, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)",
            (doc_id, filename, file_type, size_bytes, num_chunks, now),
        )
        await self._db.commit()

    async def get_document(self, doc_id: str) -> dict | None:
        async with self._db.execute(
            "SELECT * FROM documents WHERE id = ?", (doc_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def list_documents(self) -> list[dict]:
        return await self.fetch_all(
            "SELECT * FROM documents ORDER BY uploaded_at DESC"
        )

    # --- Pipeline Runs ---

    async def save_run(self, run_id: str, query: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._db.execute(
            "INSERT INTO pipeline_runs (id, query, created_at) VALUES (?, ?, ?)",
            (run_id, query, now),
        )
        await self._db.commit()

    async def get_run(self, run_id: str) -> dict | None:
        async with self._db.execute(
            "SELECT * FROM pipeline_runs WHERE id = ?", (run_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def update_run(
        self,
        run_id: str,
        status: str | None = None,
        answer: str | None = None,
        total_latency_ms: float | None = None,
    ) -> None:
        updates = []
        params = []
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if answer is not None:
            updates.append("answer = ?")
            params.append(answer)
        if total_latency_ms is not None:
            updates.append("total_latency_ms = ?")
            params.append(total_latency_ms)
        params.append(run_id)
        await self._db.execute(
            f"UPDATE pipeline_runs SET {', '.join(updates)} WHERE id = ?",
            tuple(params),
        )
        await self._db.commit()

    # --- Events ---

    async def save_event(
        self,
        run_id: str,
        event_type: str,
        step: int,
        total_steps: int,
        data: dict[str, Any] | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._db.execute(
            "INSERT INTO pipeline_events (run_id, event_type, step, total_steps, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, event_type, step, total_steps, json.dumps(data or {}), now),
        )
        await self._db.commit()

    async def get_run_events(self, run_id: str) -> list[dict]:
        rows = await self.fetch_all(
            "SELECT * FROM pipeline_events WHERE run_id = ? ORDER BY id",
            (run_id,),
        )
        for row in rows:
            row["data"] = json.loads(row["data"])
        return rows

    # --- Stats ---

    async def get_stats(self) -> dict[str, Any]:
        runs = await self.fetch_all(
            "SELECT COUNT(*) as count, AVG(total_latency_ms) as avg_latency FROM pipeline_runs WHERE status = 'completed'"
        )
        docs = await self.fetch_all("SELECT COUNT(*) as count FROM documents")
        return {
            "total_runs": runs[0]["count"],
            "avg_latency_ms": runs[0]["avg_latency"] or 0,
            "total_documents": docs[0]["count"],
        }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_database.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/db/ backend/tests/test_database.py
git commit -m "feat: add SQLite async database layer for runs, events, documents"
```

---

## Task 14: Pipeline Engine

**Files:**
- Create: `backend/app/core/pipeline.py`
- Create: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write tests for pipeline engine**

Create `backend/tests/test_pipeline.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.pipeline import PipelineEngine
from app.core.events import EventEmitter
from app.providers.manager import ProviderManager
from app.db.database import Database
from app.models.schemas import PipelineEventType


class MockLLM:
    def name(self): return "mock"
    async def generate(self, prompt, **kwargs):
        return {"content": "The answer is 42.", "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}
    async def generate_stream(self, prompt, **kwargs):
        for token in ["The ", "answer ", "is ", "42."]:
            yield token


class MockEmbedding:
    def name(self): return "mock"
    async def embed(self, texts):
        return {"embeddings": [[0.1, 0.2, 0.3] for _ in texts], "usage": {"total_tokens": len(texts)}}
    async def embed_query(self, text):
        return {"embedding": [0.1, 0.2, 0.3], "usage": {"total_tokens": 1}}
    def dimensions(self): return 3


class MockVectorDB:
    def name(self): return "mock"
    async def create_collection(self, c): pass
    async def add_documents(self, **kw): pass
    async def search(self, collection, query_embedding, top_k=5):
        from app.providers.vectordb.base import SearchResult
        return [
            SearchResult(chunk_id="c1", text="RAG is retrieval augmented generation.", score=0.95, metadata={"document_id": "d1"}),
            SearchResult(chunk_id="c2", text="It combines search with LLM.", score=0.87, metadata={"document_id": "d1"}),
        ]
    async def delete_collection(self, c): pass
    async def get_stats(self, c): return {"total_vectors": 10}


@pytest.fixture
def provider_manager():
    manager = ProviderManager()
    manager.register_llm("mock", MockLLM())
    manager.register_embedding("mock", MockEmbedding())
    manager.register_vectordb("mock", MockVectorDB())
    manager.set_active_llm("mock")
    manager.set_active_embedding("mock")
    manager.set_active_vectordb("mock")
    return manager


@pytest.fixture
def emitter():
    return EventEmitter()


class TestPipelineEngine:
    @pytest.mark.asyncio
    async def test_run_query_returns_result(self, provider_manager, emitter):
        mock_db = MagicMock(spec=Database)
        mock_db.save_run = AsyncMock()
        mock_db.save_event = AsyncMock()
        mock_db.update_run = AsyncMock()

        engine = PipelineEngine(provider_manager, emitter, mock_db)
        result = await engine.run_query(
            query="What is RAG?",
            collection="test",
        )

        assert result["answer"] == "The answer is 42."
        assert result["run_id"] is not None
        assert result["total_latency_ms"] > 0

    @pytest.mark.asyncio
    async def test_emits_all_pipeline_events(self, provider_manager, emitter):
        mock_db = MagicMock(spec=Database)
        mock_db.save_run = AsyncMock()
        mock_db.save_event = AsyncMock()
        mock_db.update_run = AsyncMock()

        received = []
        async def handler(event):
            received.append(event)
        emitter.subscribe(handler)

        engine = PipelineEngine(provider_manager, emitter, mock_db)
        await engine.run_query(query="What is RAG?", collection="test")

        event_types = [e.type for e in received]
        assert PipelineEventType.QUERY_RECEIVED in event_types
        assert PipelineEventType.QUERY_EMBEDDED in event_types
        assert PipelineEventType.RETRIEVAL_DONE in event_types
        assert PipelineEventType.PROMPT_ASSEMBLED in event_types
        assert PipelineEventType.GENERATION_DONE in event_types
        assert PipelineEventType.PIPELINE_COMPLETE in event_types

    @pytest.mark.asyncio
    async def test_persists_run_to_db(self, provider_manager, emitter):
        mock_db = MagicMock(spec=Database)
        mock_db.save_run = AsyncMock()
        mock_db.save_event = AsyncMock()
        mock_db.update_run = AsyncMock()

        engine = PipelineEngine(provider_manager, emitter, mock_db)
        await engine.run_query(query="What is RAG?", collection="test")

        mock_db.save_run.assert_called_once()
        mock_db.update_run.assert_called_once()
        assert mock_db.save_event.call_count >= 6  # at least 6 events

    @pytest.mark.asyncio
    async def test_run_query_stream(self, provider_manager, emitter):
        mock_db = MagicMock(spec=Database)
        mock_db.save_run = AsyncMock()
        mock_db.save_event = AsyncMock()
        mock_db.update_run = AsyncMock()

        engine = PipelineEngine(provider_manager, emitter, mock_db)
        tokens = []
        async for token in engine.run_query_stream(
            query="What is RAG?",
            collection="test",
        ):
            tokens.append(token)

        assert "The " in tokens
        assert "42." in tokens
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_pipeline.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement pipeline engine**

Create `backend/app/core/pipeline.py`:

```python
import time
import uuid
from typing import Any, AsyncGenerator
from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType
from app.providers.manager import ProviderManager
from app.db.database import Database

TOTAL_STEPS = 8  # query_received, query_embedded, retrieval, reranking, prompt_assembled, gen_start, gen_done, complete


class PipelineEngine:
    def __init__(
        self,
        provider_manager: ProviderManager,
        emitter: EventEmitter,
        db: Database,
    ):
        self._providers = provider_manager
        self._emitter = emitter
        self._db = db

    async def _emit_and_persist(
        self, run_id: str, event_type: PipelineEventType, step: int, data: dict
    ) -> None:
        event = PipelineEvent(
            type=event_type, step=step, total_steps=TOTAL_STEPS, data=data
        )
        await self._emitter.emit(event)
        await self._db.save_event(
            run_id=run_id,
            event_type=event_type.value,
            step=step,
            total_steps=TOTAL_STEPS,
            data=data,
        )

    async def run_query(
        self,
        query: str,
        collection: str,
        top_k: int = 5,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        run_id = str(uuid.uuid4())
        start_time = time.time()
        await self._db.save_run(run_id=run_id, query=query)

        # Step 1: Query received
        await self._emit_and_persist(
            run_id, PipelineEventType.QUERY_RECEIVED, 1, {"text": query}
        )

        # Step 2: Embed query
        embed_start = time.time()
        embedding_provider = self._providers.get_embedding()
        embed_result = await embedding_provider.embed_query(query)
        query_vector = embed_result["embedding"]
        embed_ms = (time.time() - embed_start) * 1000

        await self._emit_and_persist(
            run_id,
            PipelineEventType.QUERY_EMBEDDED,
            2,
            {
                "vector_dim": len(query_vector),
                "model": embedding_provider.name(),
                "latency_ms": round(embed_ms, 2),
            },
        )

        # Step 3: Retrieval
        retrieval_start = time.time()
        vectordb = self._providers.get_vectordb()
        results = await vectordb.search(
            collection=collection, query_embedding=query_vector, top_k=top_k
        )
        retrieval_ms = (time.time() - retrieval_start) * 1000

        await self._emit_and_persist(
            run_id,
            PipelineEventType.RETRIEVAL_DONE,
            3,
            {
                "chunks": [
                    {"id": r.chunk_id, "text": r.text, "score": r.score}
                    for r in results
                ],
                "scores": [r.score for r in results],
                "latency_ms": round(retrieval_ms, 2),
            },
        )

        # Step 4: Prompt assembly
        context = "\n\n".join(
            [f"[Chunk {i+1} (score: {r.score:.2f})]: {r.text}" for i, r in enumerate(results)]
        )
        system_prompt = "You are a helpful assistant. Answer the question based on the provided context. If the context doesn't contain relevant information, say so."
        full_prompt = f"Context:\n{context}\n\nQuestion: {query}"

        await self._emit_and_persist(
            run_id,
            PipelineEventType.PROMPT_ASSEMBLED,
            5,
            {
                "template": "context + question",
                "chunks_injected": len(results),
                "total_chars": len(full_prompt),
            },
        )

        # Step 5: Generation
        llm = self._providers.get_llm()
        gen_start = time.time()

        await self._emit_and_persist(
            run_id,
            PipelineEventType.GENERATION_START,
            6,
            {"model": llm.name(), "temperature": temperature, "max_tokens": max_tokens},
        )

        gen_result = await llm.generate(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        gen_ms = (time.time() - gen_start) * 1000

        await self._emit_and_persist(
            run_id,
            PipelineEventType.GENERATION_DONE,
            7,
            {
                "total_tokens": gen_result["usage"].get("total_tokens", 0),
                "latency_ms": round(gen_ms, 2),
            },
        )

        # Step 6: Complete
        total_ms = (time.time() - start_time) * 1000
        await self._emit_and_persist(
            run_id,
            PipelineEventType.PIPELINE_COMPLETE,
            8,
            {"total_latency_ms": round(total_ms, 2)},
        )

        await self._db.update_run(
            run_id=run_id,
            status="completed",
            answer=gen_result["content"],
            total_latency_ms=round(total_ms, 2),
        )

        return {
            "run_id": run_id,
            "answer": gen_result["content"],
            "total_latency_ms": round(total_ms, 2),
            "chunks": [
                {"id": r.chunk_id, "text": r.text, "score": r.score}
                for r in results
            ],
        }

    async def run_query_stream(
        self,
        query: str,
        collection: str,
        top_k: int = 5,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """Same as run_query but streams tokens from the LLM."""
        run_id = str(uuid.uuid4())
        start_time = time.time()
        await self._db.save_run(run_id=run_id, query=query)

        await self._emit_and_persist(
            run_id, PipelineEventType.QUERY_RECEIVED, 1, {"text": query}
        )

        # Embed query
        embedding_provider = self._providers.get_embedding()
        embed_result = await embedding_provider.embed_query(query)
        query_vector = embed_result["embedding"]

        await self._emit_and_persist(
            run_id, PipelineEventType.QUERY_EMBEDDED, 2,
            {"vector_dim": len(query_vector), "model": embedding_provider.name()},
        )

        # Retrieval
        vectordb = self._providers.get_vectordb()
        results = await vectordb.search(
            collection=collection, query_embedding=query_vector, top_k=top_k
        )

        await self._emit_and_persist(
            run_id, PipelineEventType.RETRIEVAL_DONE, 3,
            {"chunks": [{"id": r.chunk_id, "text": r.text, "score": r.score} for r in results]},
        )

        # Prompt assembly
        context = "\n\n".join(
            [f"[Chunk {i+1}]: {r.text}" for i, r in enumerate(results)]
        )
        system_prompt = "You are a helpful assistant. Answer based on the provided context."
        full_prompt = f"Context:\n{context}\n\nQuestion: {query}"

        await self._emit_and_persist(
            run_id, PipelineEventType.PROMPT_ASSEMBLED, 5,
            {"chunks_injected": len(results)},
        )

        # Stream generation
        llm = self._providers.get_llm()
        await self._emit_and_persist(
            run_id, PipelineEventType.GENERATION_START, 6,
            {"model": llm.name()},
        )

        full_response = ""
        token_index = 0
        async for token in llm.generate_stream(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            full_response += token
            await self._emitter.emit(
                PipelineEvent(
                    type=PipelineEventType.TOKEN_GENERATED,
                    step=6,
                    total_steps=TOTAL_STEPS,
                    data={"token": token, "index": token_index},
                )
            )
            token_index += 1
            yield token

        total_ms = (time.time() - start_time) * 1000
        await self._emit_and_persist(
            run_id, PipelineEventType.GENERATION_DONE, 7,
            {"total_tokens": token_index, "latency_ms": round(total_ms, 2)},
        )
        await self._emit_and_persist(
            run_id, PipelineEventType.PIPELINE_COMPLETE, 8,
            {"total_latency_ms": round(total_ms, 2)},
        )
        await self._db.update_run(
            run_id=run_id, status="completed", answer=full_response,
            total_latency_ms=round(total_ms, 2),
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_pipeline.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: add pipeline engine with event emission and streaming"
```

---

## Task 15: API Routes — Documents

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/documents.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_api_documents.py`

- [ ] **Step 1: Write shared test fixtures**

Create `backend/tests/conftest.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.save_document = AsyncMock()
    db.get_document = AsyncMock(return_value=None)
    db.list_documents = AsyncMock(return_value=[])
    db.save_run = AsyncMock()
    db.update_run = AsyncMock()
    db.save_event = AsyncMock()
    db.get_run = AsyncMock(return_value=None)
    db.get_run_events = AsyncMock(return_value=[])
    db.get_stats = AsyncMock(return_value={"total_runs": 0, "avg_latency_ms": 0, "total_documents": 0})
    return db


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 2: Write tests for document routes**

Create `backend/tests/test_api_documents.py`:

```python
import io
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestDocumentRoutes:
    @pytest.mark.asyncio
    async def test_list_documents_empty(self, client):
        with patch("app.api.routes.documents.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.list_documents = AsyncMock(return_value=[])
            mock_get_db.return_value = mock_db

            response = await client.get("/api/documents")
            assert response.status_code == 200
            assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_documents_with_data(self, client):
        with patch("app.api.routes.documents.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.list_documents = AsyncMock(
                return_value=[
                    {"id": "d1", "filename": "test.txt", "file_type": "txt",
                     "size_bytes": 100, "num_chunks": 5, "uploaded_at": "2026-04-13T00:00:00Z"},
                ]
            )
            mock_get_db.return_value = mock_db

            response = await client.get("/api/documents")
            assert response.status_code == 200
            assert len(response.json()) == 1
            assert response.json()[0]["filename"] == "test.txt"

    @pytest.mark.asyncio
    async def test_upload_txt_document(self, client):
        with patch("app.api.routes.documents.get_db") as mock_get_db, \
             patch("app.api.routes.documents.get_provider_manager") as mock_get_pm, \
             patch("app.api.routes.documents.get_emitter") as mock_get_emitter:
            mock_db = MagicMock()
            mock_db.save_document = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_embed = MagicMock()
            mock_embed.embed = AsyncMock(return_value={"embeddings": [[0.1, 0.2]], "usage": {"total_tokens": 1}})
            mock_embed.dimensions.return_value = 2

            mock_vdb = MagicMock()
            mock_vdb.create_collection = AsyncMock()
            mock_vdb.add_documents = AsyncMock()

            mock_pm = MagicMock()
            mock_pm.get_embedding.return_value = mock_embed
            mock_pm.get_vectordb.return_value = mock_vdb
            mock_get_pm.return_value = mock_pm

            from app.core.events import EventEmitter
            mock_get_emitter.return_value = EventEmitter()

            file_content = b"This is test content for upload."
            response = await client.post(
                "/api/documents/upload",
                files={"file": ("test.txt", io.BytesIO(file_content), "text/plain")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == "test.txt"
            assert data["file_type"] == "txt"

    @pytest.mark.asyncio
    async def test_upload_unsupported_format(self, client):
        file_content = b"content"
        response = await client.post(
            "/api/documents/upload",
            files={"file": ("test.xyz", io.BytesIO(file_content), "application/octet-stream")},
        )
        assert response.status_code == 400
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_api_documents.py -v
```

Expected: FAIL — import errors

- [ ] **Step 4: Implement document routes**

Create `backend/app/api/__init__.py` (empty file).
Create `backend/app/api/routes/__init__.py` (empty file).

Create `backend/app/api/routes/documents.py`:

```python
import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.processing.parser import DocumentParser
from app.processing.chunker import Chunker
from app.processing.embedder import Embedder
from app.models.schemas import ChunkingConfig

router = APIRouter(prefix="/api/documents", tags=["documents"])

# These will be injected via app state at startup
_db = None
_provider_manager = None
_emitter = None


def init_dependencies(db, provider_manager, emitter):
    global _db, _provider_manager, _emitter
    _db = db
    _provider_manager = provider_manager
    _emitter = emitter


def get_db():
    return _db


def get_provider_manager():
    return _provider_manager


def get_emitter():
    return _emitter


@router.get("")
async def list_documents():
    db = get_db()
    return await db.list_documents()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    collection: str = "default",
):
    # Validate file type
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in DocumentParser._SUPPORTED:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    db = get_db()
    pm = get_provider_manager()
    emitter = get_emitter()

    # Save uploaded file
    upload_dir = os.environ.get("UPLOAD_DIR", "./uploads")
    os.makedirs(upload_dir, exist_ok=True)
    doc_id = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, f"{doc_id}_{file.filename}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse document
    parse_result = DocumentParser.parse(file_path)

    # Chunk document
    config = ChunkingConfig()
    chunks = Chunker.chunk(
        parse_result.text,
        strategy=config.strategy,
        chunk_size=config.chunk_size,
        overlap=config.overlap,
    )

    # Embed and store
    embedder = Embedder(pm.get_embedding(), pm.get_vectordb(), emitter)
    await embedder.embed_and_store(
        chunks=chunks,
        document_id=doc_id,
        collection=collection,
    )

    # Save to DB
    await db.save_document(
        doc_id=doc_id,
        filename=file.filename,
        file_type=ext,
        size_bytes=len(content),
        num_chunks=len(chunks),
    )

    return {
        "id": doc_id,
        "filename": file.filename,
        "file_type": ext,
        "size_bytes": len(content),
        "num_chunks": len(chunks),
    }
```

- [ ] **Step 5: Wire routes into main app**

Update `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import documents

app = FastAPI(
    title="RAG Pipeline Visualization",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_api_documents.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/ backend/app/main.py backend/tests/conftest.py backend/tests/test_api_documents.py
git commit -m "feat: add document upload and list API routes"
```

---

## Task 16: API Routes — Query, Providers, Stats

**Files:**
- Create: `backend/app/api/routes/query.py`
- Create: `backend/app/api/routes/providers.py`
- Create: `backend/app/api/routes/stats.py`
- Create: `backend/tests/test_api_query.py`
- Create: `backend/tests/test_api_providers.py`
- Create: `backend/tests/test_api_stats.py`

- [ ] **Step 1: Write tests for query route**

Create `backend/tests/test_api_query.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestQueryRoutes:
    @pytest.mark.asyncio
    async def test_run_query(self, client):
        with patch("app.api.routes.query.get_pipeline") as mock_get:
            mock_engine = MagicMock()
            mock_engine.run_query = AsyncMock(
                return_value={
                    "run_id": "run-123",
                    "answer": "RAG is great.",
                    "total_latency_ms": 500.0,
                    "chunks": [],
                }
            )
            mock_get.return_value = mock_engine

            response = await client.post(
                "/api/query",
                json={"text": "What is RAG?", "mode": "dashboard"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["answer"] == "RAG is great."
            assert data["run_id"] == "run-123"

    @pytest.mark.asyncio
    async def test_get_run_history(self, client):
        with patch("app.api.routes.query.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.get_run = AsyncMock(
                return_value={"id": "run-1", "query": "test", "status": "completed"}
            )
            mock_db.get_run_events = AsyncMock(
                return_value=[
                    {"event_type": "query_received", "step": 1, "data": {}},
                ]
            )
            mock_get_db.return_value = mock_db

            response = await client.get("/api/query/run-1/history")
            assert response.status_code == 200
            data = response.json()
            assert data["run"]["id"] == "run-1"
            assert len(data["events"]) == 1
```

- [ ] **Step 2: Write tests for providers route**

Create `backend/tests/test_api_providers.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestProviderRoutes:
    @pytest.mark.asyncio
    async def test_list_providers(self, client):
        with patch("app.api.routes.providers.get_provider_manager") as mock_get:
            mock_pm = MagicMock()
            mock_pm.list_providers.return_value = {
                "llm": {"available": ["openai"], "active": "openai"},
                "embedding": {"available": ["openai"], "active": "openai"},
                "vectordb": {"available": ["chromadb"], "active": "chromadb"},
            }
            mock_get.return_value = mock_pm

            response = await client.get("/api/providers")
            assert response.status_code == 200
            data = response.json()
            assert "openai" in data["llm"]["available"]
```

- [ ] **Step 3: Write tests for stats route**

Create `backend/tests/test_api_stats.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestStatsRoutes:
    @pytest.mark.asyncio
    async def test_get_stats(self, client):
        with patch("app.api.routes.stats.get_db") as mock_get:
            mock_db = MagicMock()
            mock_db.get_stats = AsyncMock(
                return_value={
                    "total_runs": 42,
                    "avg_latency_ms": 350.5,
                    "total_documents": 10,
                }
            )
            mock_get.return_value = mock_db

            response = await client.get("/api/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["total_runs"] == 42
```

- [ ] **Step 4: Run all new tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_api_query.py tests/test_api_providers.py tests/test_api_stats.py -v
```

Expected: FAIL — import errors

- [ ] **Step 5: Implement query route**

Create `backend/app/api/routes/query.py`:

```python
from fastapi import APIRouter, HTTPException
from app.models.schemas import QueryRequest

router = APIRouter(prefix="/api/query", tags=["query"])

_pipeline = None
_db = None


def init_dependencies(pipeline, db):
    global _pipeline, _db
    _pipeline = pipeline
    _db = db


def get_pipeline():
    return _pipeline


def get_db():
    return _db


@router.post("")
async def run_query(request: QueryRequest):
    engine = get_pipeline()
    if engine is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    result = await engine.run_query(
        query=request.text,
        collection="default",
    )
    return result


@router.get("/{run_id}/history")
async def get_run_history(run_id: str):
    db = get_db()
    run = await db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    events = await db.get_run_events(run_id)
    return {"run": run, "events": events}
```

- [ ] **Step 6: Implement providers route**

Create `backend/app/api/routes/providers.py`:

```python
from fastapi import APIRouter, HTTPException
from app.models.schemas import ProviderConfig

router = APIRouter(prefix="/api/providers", tags=["providers"])

_provider_manager = None


def init_dependencies(provider_manager):
    global _provider_manager
    _provider_manager = provider_manager


def get_provider_manager():
    return _provider_manager


@router.get("")
async def list_providers():
    pm = get_provider_manager()
    return pm.list_providers()


@router.put("/config")
async def update_provider_config(config: ProviderConfig):
    pm = get_provider_manager()
    try:
        if config.provider_type.value == "llm":
            pm.set_active_llm(config.provider_name)
        elif config.provider_type.value == "embedding":
            pm.set_active_embedding(config.provider_name)
        elif config.provider_type.value == "vectordb":
            pm.set_active_vectordb(config.provider_name)
        return {"status": "ok", "active": config.provider_name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

- [ ] **Step 7: Implement stats route**

Create `backend/app/api/routes/stats.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/stats", tags=["stats"])

_db = None


def init_dependencies(db):
    global _db
    _db = db


def get_db():
    return _db


@router.get("")
async def get_stats():
    db = get_db()
    return await db.get_stats()
```

- [ ] **Step 8: Wire all routes into main app**

Update `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import documents, query, providers, stats

app = FastAPI(
    title="RAG Pipeline Visualization",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(query.router)
app.include_router(providers.router)
app.include_router(stats.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 9: Run all tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_api_query.py tests/test_api_providers.py tests/test_api_stats.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/app/api/routes/ backend/app/main.py backend/tests/test_api_query.py backend/tests/test_api_providers.py backend/tests/test_api_stats.py
git commit -m "feat: add query, providers, and stats API routes"
```

---

## Task 17: WebSocket Handler

**Files:**
- Create: `backend/app/api/websocket.py`
- Create: `backend/tests/test_websocket.py`

- [ ] **Step 1: Write tests for WebSocket handler**

Create `backend/tests/test_websocket.py`:

```python
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType


class TestWebSocket:
    def test_websocket_connects(self):
        with patch("app.api.websocket.get_emitter") as mock_get:
            mock_get.return_value = EventEmitter()
            client = TestClient(app)
            with client.websocket_connect("/ws/pipeline") as ws:
                # Connection should succeed
                ws.close()

    def test_websocket_receives_events(self):
        emitter = EventEmitter()

        with patch("app.api.websocket.get_emitter") as mock_get:
            mock_get.return_value = emitter
            client = TestClient(app)

            with client.websocket_connect("/ws/pipeline") as ws:
                # Send a start_query command
                ws.send_json({"type": "ping"})
                data = ws.receive_json()
                assert data["type"] == "pong"

    def test_websocket_handles_start_query(self):
        emitter = EventEmitter()

        with patch("app.api.websocket.get_emitter") as mock_get, \
             patch("app.api.websocket.get_pipeline") as mock_pipeline:
            mock_get.return_value = emitter

            mock_engine = MagicMock()
            mock_engine.run_query = AsyncMock(
                return_value={"run_id": "r1", "answer": "test", "total_latency_ms": 100}
            )
            mock_pipeline.return_value = mock_engine

            client = TestClient(app)
            with client.websocket_connect("/ws/pipeline") as ws:
                ws.send_json({
                    "type": "start_query",
                    "payload": {"text": "What is RAG?", "mode": "dashboard"},
                })
                # Should receive at least one response
                data = ws.receive_json()
                assert data is not None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_websocket.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement WebSocket handler**

Create `backend/app/api/websocket.py`:

```python
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent

router = APIRouter()

_emitter = None
_pipeline = None


def init_dependencies(emitter, pipeline):
    global _emitter, _pipeline
    _emitter = emitter
    _pipeline = pipeline


def get_emitter():
    return _emitter


def get_pipeline():
    return _pipeline


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_event(self, websocket: WebSocket, event: PipelineEvent):
        await websocket.send_json(
            {
                "type": "pipeline_event",
                "event": event.type.value,
                "step": event.step,
                "total_steps": event.total_steps,
                "data": event.data,
                "timestamp": event.timestamp.isoformat(),
            }
        )


manager = ConnectionManager()


@router.websocket("/ws/pipeline")
async def pipeline_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    emitter = get_emitter()

    # Subscribe to pipeline events and forward to this client
    async def forward_event(event: PipelineEvent):
        try:
            await manager.send_event(websocket, event)
        except Exception:
            pass  # client may have disconnected

    emitter.subscribe(forward_event)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "start_query":
                payload = data.get("payload", {})
                text = payload.get("text", "")
                mode = payload.get("mode", "dashboard")

                engine = get_pipeline()
                if engine is None:
                    await websocket.send_json(
                        {"type": "error", "data": {"error": "Pipeline not initialized"}}
                    )
                    continue

                # Run the query asynchronously
                asyncio.create_task(
                    _run_pipeline_query(websocket, engine, text, mode)
                )

    except WebSocketDisconnect:
        emitter.unsubscribe(forward_event)
        manager.disconnect(websocket)


async def _run_pipeline_query(websocket, engine, text, mode):
    try:
        if mode == "step_by_step":
            # For step_by_step, use streaming
            async for token in engine.run_query_stream(
                query=text, collection="default"
            ):
                pass  # events are emitted via the emitter, forwarded to WS
        else:
            await engine.run_query(query=text, collection="default")
    except Exception as e:
        try:
            await websocket.send_json(
                {"type": "error", "event": "pipeline_failed", "data": {"error": str(e)}}
            )
        except Exception:
            pass
```

- [ ] **Step 4: Wire WebSocket into main app**

Update `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import documents, query, providers, stats
from app.api import websocket

app = FastAPI(
    title="RAG Pipeline Visualization",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(query.router)
app.include_router(providers.router)
app.include_router(stats.router)
app.include_router(websocket.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_websocket.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/websocket.py backend/app/main.py backend/tests/test_websocket.py
git commit -m "feat: add WebSocket handler for pipeline event streaming"
```

---

## Task 18: Main App Wiring + Integration

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the full startup wiring**

Replace `backend/app/main.py` with the final version:

```python
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.providers.manager import ProviderManager
from app.providers.llm.openai_llm import OpenAILLMProvider
from app.providers.llm.anthropic_llm import AnthropicLLMProvider
from app.providers.llm.ollama_llm import OllamaLLMProvider
from app.providers.embedding.openai_embed import OpenAIEmbeddingProvider
from app.providers.embedding.cohere_embed import CohereEmbeddingProvider
from app.providers.embedding.ollama_embed import OllamaEmbeddingProvider
from app.providers.vectordb.chroma_db import ChromaDBProvider

from app.api.routes import documents, query, providers, stats
from app.api import websocket


def create_provider_manager() -> ProviderManager:
    pm = ProviderManager()

    # Register LLM providers
    if settings.OPENAI_API_KEY:
        pm.register_llm("openai", OpenAILLMProvider(api_key=settings.OPENAI_API_KEY))
    if settings.ANTHROPIC_API_KEY:
        pm.register_llm(
            "anthropic", AnthropicLLMProvider(api_key=settings.ANTHROPIC_API_KEY)
        )
    pm.register_llm(
        "ollama", OllamaLLMProvider(base_url=settings.OLLAMA_BASE_URL)
    )

    # Register embedding providers
    if settings.OPENAI_API_KEY:
        pm.register_embedding(
            "openai", OpenAIEmbeddingProvider(api_key=settings.OPENAI_API_KEY)
        )
    if settings.COHERE_API_KEY:
        pm.register_embedding(
            "cohere", CohereEmbeddingProvider(api_key=settings.COHERE_API_KEY)
        )
    pm.register_embedding(
        "ollama", OllamaEmbeddingProvider(base_url=settings.OLLAMA_BASE_URL)
    )

    # Register vector DB providers (ChromaDB always available)
    pm.register_vectordb(
        "chromadb", ChromaDBProvider(persist_dir=settings.CHROMA_PERSIST_DIR)
    )

    # Set defaults: prefer OpenAI if available, else Ollama
    default_provider = "openai" if settings.OPENAI_API_KEY else "ollama"
    try:
        pm.set_active_llm(default_provider)
    except ValueError:
        pm.set_active_llm("ollama")
    try:
        pm.set_active_embedding(default_provider)
    except ValueError:
        pm.set_active_embedding("ollama")
    pm.set_active_vectordb("chromadb")

    return pm


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.DATABASE_URL), exist_ok=True)

    db = Database(settings.DATABASE_URL)
    await db.initialize()

    emitter = EventEmitter()
    pm = create_provider_manager()
    pipeline = PipelineEngine(pm, emitter, db)

    # Inject dependencies into route modules
    documents.init_dependencies(db, pm, emitter)
    query.init_dependencies(pipeline, db)
    providers.init_dependencies(pm)
    stats.init_dependencies(db)
    websocket.init_dependencies(emitter, pipeline)

    yield

    # Shutdown
    await db.close()


app = FastAPI(
    title="RAG Pipeline Visualization",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(query.router)
app.include_router(providers.router)
app.include_router(stats.router)
app.include_router(websocket.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Verify the full app starts**

```bash
cd backend
uvicorn app.main:app --port 8000 &
sleep 2
curl http://localhost:8000/health
curl http://localhost:8000/api/providers
curl http://localhost:8000/api/stats
curl http://localhost:8000/api/documents
kill %1
```

Expected:
- `/health` → `{"status":"ok"}`
- `/api/providers` → JSON with available providers
- `/api/stats` → `{"total_runs":0,...}`
- `/api/documents` → `[]`

- [ ] **Step 3: Run full test suite**

```bash
cd backend
python -m pytest tests/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: wire up full app startup with providers, DB, and pipeline"
```

---

## Task 19: UMAP Endpoint for Embedding Visualization

**Files:**
- Create: `backend/app/api/routes/embeddings.py`
- Modify: `backend/app/main.py` (add route)

- [ ] **Step 1: Write test for UMAP reduction endpoint**

Create `backend/tests/test_api_embeddings.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestEmbeddingsRoutes:
    @pytest.mark.asyncio
    async def test_get_embeddings_3d(self, client):
        with patch("app.api.routes.embeddings.get_provider_manager") as mock_pm, \
             patch("app.api.routes.embeddings.umap.UMAP") as mock_umap:
            # Mock vectordb with stored embeddings
            mock_vdb = MagicMock()
            mock_collection = MagicMock()
            mock_collection.get.return_value = {
                "ids": ["c1", "c2", "c3"],
                "documents": ["text1", "text2", "text3"],
                "embeddings": [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]],
                "metadatas": [{"document_id": "d1"}, {"document_id": "d1"}, {"document_id": "d2"}],
            }
            mock_vdb._collections = {"default": mock_collection}
            mock_pm_instance = MagicMock()
            mock_pm_instance.get_vectordb.return_value = mock_vdb
            mock_pm.return_value = mock_pm_instance

            # Mock UMAP reduction
            mock_reducer = MagicMock()
            mock_reducer.fit_transform.return_value = np.array([
                [1.0, 2.0, 3.0],
                [4.0, 5.0, 6.0],
                [7.0, 8.0, 9.0],
            ])
            mock_umap.return_value = mock_reducer

            response = await client.get("/api/embeddings/3d?collection=default")
            assert response.status_code == 200
            data = response.json()
            assert len(data["points"]) == 3
            assert "x" in data["points"][0]
            assert "y" in data["points"][0]
            assert "z" in data["points"][0]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
python -m pytest tests/test_api_embeddings.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement embeddings route**

Create `backend/app/api/routes/embeddings.py`:

```python
from fastapi import APIRouter, HTTPException, Query
import numpy as np
import umap

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])

_provider_manager = None


def init_dependencies(provider_manager):
    global _provider_manager
    _provider_manager = provider_manager


def get_provider_manager():
    return _provider_manager


@router.get("/3d")
async def get_embeddings_3d(collection: str = Query(default="default")):
    pm = get_provider_manager()
    vdb = pm.get_vectordb()

    # Get all vectors from the collection (ChromaDB specific for now)
    if not hasattr(vdb, "_collections") or collection not in vdb._collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    col = vdb._collections[collection]
    data = col.get(include=["embeddings", "documents", "metadatas"])

    if not data["ids"]:
        return {"points": []}

    embeddings = np.array(data["embeddings"])

    # Reduce to 3D with UMAP
    n_samples = len(embeddings)
    n_neighbors = min(15, n_samples - 1) if n_samples > 1 else 1

    if n_samples < 2:
        coords = np.zeros((n_samples, 3))
    else:
        reducer = umap.UMAP(n_components=3, n_neighbors=n_neighbors, random_state=42)
        coords = reducer.fit_transform(embeddings)

    points = []
    for i in range(n_samples):
        points.append({
            "id": data["ids"][i],
            "x": float(coords[i][0]),
            "y": float(coords[i][1]),
            "z": float(coords[i][2]),
            "text": data["documents"][i] if data["documents"] else "",
            "metadata": data["metadatas"][i] if data["metadatas"] else {},
        })

    return {"points": points, "total": n_samples}
```

- [ ] **Step 4: Add route and dependency injection to main app**

Add to imports in `backend/app/main.py`:

```python
from app.api.routes import documents, query, providers, stats, embeddings
```

Add in the lifespan function after the other `init_dependencies` calls:

```python
    embeddings.init_dependencies(pm)
```

Add the router:

```python
app.include_router(embeddings.router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend
python -m pytest tests/test_api_embeddings.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/embeddings.py backend/app/main.py backend/tests/test_api_embeddings.py
git commit -m "feat: add UMAP 3D embedding reduction endpoint"
```

---

## Task 20: Final Integration Test

**Files:**
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write integration test**

Create `backend/tests/test_integration.py`:

```python
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import Settings
from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.providers.manager import ProviderManager
from app.processing.parser import DocumentParser
from app.processing.chunker import Chunker
from app.processing.embedder import Embedder
from app.models.schemas import ChunkingStrategy, PipelineEventType


class MockLLM:
    def name(self): return "mock"
    async def generate(self, prompt, **kwargs):
        return {"content": "Based on the context, RAG stands for Retrieval Augmented Generation.", "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}}
    async def generate_stream(self, prompt, **kwargs):
        for token in ["Based ", "on ", "the ", "context, ", "RAG ", "stands ", "for ", "Retrieval ", "Augmented ", "Generation."]:
            yield token


class MockEmbedding:
    def name(self): return "mock"
    async def embed(self, texts):
        import random
        return {"embeddings": [[random.random() for _ in range(8)] for _ in texts], "usage": {"total_tokens": len(texts) * 5}}
    async def embed_query(self, text):
        import random
        return {"embedding": [random.random() for _ in range(8)], "usage": {"total_tokens": 5}}
    def dimensions(self): return 8


class MockVectorDB:
    def __init__(self):
        self._store = {}
    def name(self): return "mock"
    async def create_collection(self, collection):
        if collection not in self._store:
            self._store[collection] = []
    async def add_documents(self, collection, ids, texts, embeddings, metadatas=None):
        for i in range(len(ids)):
            self._store[collection].append({
                "id": ids[i], "text": texts[i], "embedding": embeddings[i],
                "metadata": metadatas[i] if metadatas else {},
            })
    async def search(self, collection, query_embedding, top_k=5):
        from app.providers.vectordb.base import SearchResult
        docs = self._store.get(collection, [])[:top_k]
        return [
            SearchResult(chunk_id=d["id"], text=d["text"], score=0.9 - i * 0.1, metadata=d["metadata"])
            for i, d in enumerate(docs)
        ]
    async def delete_collection(self, collection):
        self._store.pop(collection, None)
    async def get_stats(self, collection):
        return {"total_vectors": len(self._store.get(collection, []))}


class TestFullPipeline:
    @pytest.mark.asyncio
    async def test_ingest_then_query(self, tmp_path):
        """End-to-end: create document, chunk, embed, store, then query."""
        # Setup
        db = Database(str(tmp_path / "test.db"))
        await db.initialize()
        emitter = EventEmitter()

        pm = ProviderManager()
        pm.register_llm("mock", MockLLM())
        pm.register_embedding("mock", MockEmbedding())
        pm.register_vectordb("mock", MockVectorDB())
        pm.set_active_llm("mock")
        pm.set_active_embedding("mock")
        pm.set_active_vectordb("mock")

        # Step 1: Create a test document
        doc_file = tmp_path / "rag_intro.txt"
        doc_file.write_text(
            "RAG stands for Retrieval Augmented Generation. "
            "It is a technique that combines information retrieval with text generation. "
            "First, relevant documents are retrieved from a knowledge base. "
            "Then, these documents are used as context for a language model to generate answers. "
            "This approach reduces hallucinations and provides more accurate responses."
        )

        # Step 2: Parse
        parse_result = DocumentParser.parse(str(doc_file))
        assert parse_result.file_type == "txt"
        assert parse_result.char_count > 0

        # Step 3: Chunk
        chunks = Chunker.chunk(
            parse_result.text,
            strategy=ChunkingStrategy.RECURSIVE,
            chunk_size=100,
            overlap=20,
        )
        assert len(chunks) >= 2

        # Step 4: Embed and store
        embedder = Embedder(pm.get_embedding(), pm.get_vectordb(), emitter)
        embed_result = await embedder.embed_and_store(
            chunks=chunks, document_id="doc_1", collection="test_collection"
        )
        assert embed_result["num_embedded"] == len(chunks)

        # Step 5: Run a query through the pipeline
        events_received = []
        async def track_events(event):
            events_received.append(event)
        emitter.subscribe(track_events)

        pipeline = PipelineEngine(pm, emitter, db)
        result = await pipeline.run_query(
            query="What is RAG?",
            collection="test_collection",
            top_k=3,
        )

        # Verify result
        assert result["answer"] is not None
        assert "RAG" in result["answer"] or "Retrieval" in result["answer"]
        assert result["total_latency_ms"] > 0
        assert result["run_id"] is not None

        # Verify events
        event_types = [e.type for e in events_received]
        assert PipelineEventType.QUERY_RECEIVED in event_types
        assert PipelineEventType.QUERY_EMBEDDED in event_types
        assert PipelineEventType.RETRIEVAL_DONE in event_types
        assert PipelineEventType.GENERATION_DONE in event_types
        assert PipelineEventType.PIPELINE_COMPLETE in event_types

        # Verify DB persistence
        run = await db.get_run(result["run_id"])
        assert run["status"] == "completed"
        db_events = await db.get_run_events(result["run_id"])
        assert len(db_events) >= 6

        await db.close()
```

- [ ] **Step 2: Run integration test**

```bash
cd backend
python -m pytest tests/test_integration.py -v
```

Expected: PASS.

- [ ] **Step 3: Run complete test suite**

```bash
cd backend
python -m pytest tests/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_integration.py
git commit -m "test: add end-to-end integration test for full RAG pipeline"
```
