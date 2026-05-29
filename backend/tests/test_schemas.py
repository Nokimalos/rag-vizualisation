import pytest
from app.models.schemas import (
    PipelineEvent, PipelineEventType, QueryRequest, QueryResponse,
    DocumentInfo, ProviderConfig, ProviderType, ChunkingStrategy,
    ChunkingConfig, RetrievalConfig, PipelineRunSummary, StepSummary,
)

class TestPipelineEvent:
    def test_create_event(self):
        event = PipelineEvent(type=PipelineEventType.QUERY_RECEIVED, step=1, total_steps=8, data={"text": "What is RAG?"})
        assert event.type == PipelineEventType.QUERY_RECEIVED
        assert event.step == 1
        assert event.timestamp is not None

    def test_event_serialization(self):
        event = PipelineEvent(type=PipelineEventType.TOKEN_GENERATED, step=7, total_steps=8, data={"token": "Hello", "index": 0})
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
        config = ProviderConfig(provider_type=ProviderType.LLM, provider_name="openai", model="gpt-4o", settings={"temperature": 0.7, "max_tokens": 2048})
        assert config.provider_name == "openai"
        assert config.settings["temperature"] == 0.7

class TestChunkingConfig:
    def test_default_values(self):
        config = ChunkingConfig()
        assert config.strategy == ChunkingStrategy.RECURSIVE
        assert config.chunk_size == 512
        assert config.overlap == 50

    def test_custom_values(self):
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=1024, overlap=100)
        assert config.chunk_size == 1024

class TestRetrievalConfig:
    def test_default_values(self):
        config = RetrievalConfig()
        assert config.top_k == 5
        assert config.similarity_threshold == 0.7
        assert config.reranking_enabled is False
