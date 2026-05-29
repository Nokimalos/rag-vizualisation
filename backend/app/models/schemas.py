from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


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


class PipelineEvent(BaseModel):
    type: PipelineEventType
    step: int
    total_steps: int
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class QueryRequest(BaseModel):
    text: str
    mode: str = "dashboard"
    collection: str = "default"


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
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProviderConfig(BaseModel):
    provider_type: ProviderType
    provider_name: str
    model: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)


class ChunkingConfig(BaseModel):
    strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE
    chunk_size: int = 512
    overlap: int = 50


class RetrievalConfig(BaseModel):
    top_k: int = 5
    similarity_threshold: float = 0.7
    reranking_enabled: bool = False


class StepSummary(BaseModel):
    name: str
    latency_ms: float
    status: str
    data: dict[str, Any] = Field(default_factory=dict)


class PipelineRunSummary(BaseModel):
    run_id: str
    query: str
    answer: str | None = None
    total_latency_ms: float
    steps: list[StepSummary] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
