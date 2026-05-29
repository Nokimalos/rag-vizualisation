import pytest
from typing import Any, AsyncGenerator
from unittest.mock import MagicMock, AsyncMock

from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.providers.vectordb.base import SearchResult


# ---------------------------------------------------------------------------
# Mock providers
# ---------------------------------------------------------------------------

class MockLLM:
    def name(self):
        return "mock"

    async def generate(self, prompt, **kwargs):
        return {
            "content": "The answer is 42.",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

    async def generate_stream(self, prompt, **kwargs):
        for token in ["The ", "answer ", "is ", "42."]:
            yield token


class MockEmbedding:
    def name(self):
        return "mock"

    async def embed(self, texts):
        return {
            "embeddings": [[0.1, 0.2, 0.3] for _ in texts],
            "usage": {"total_tokens": len(texts)},
        }

    async def embed_query(self, text):
        return {"embedding": [0.1, 0.2, 0.3], "usage": {"total_tokens": 1}}

    def dimensions(self):
        return 3


class MockVectorDB:
    def name(self):
        return "mock"

    async def create_collection(self, c):
        pass

    async def add_documents(self, **kw):
        pass

    async def search(self, collection, query_embedding, top_k=5):
        return [
            SearchResult(
                chunk_id="c1",
                text="RAG is retrieval augmented generation.",
                score=0.95,
                metadata={"document_id": "d1"},
            ),
            SearchResult(
                chunk_id="c2",
                text="It combines search with LLM.",
                score=0.87,
                metadata={"document_id": "d1"},
            ),
        ]

    async def delete_collection(self, c):
        pass

    async def get_stats(self, c):
        return {"total_vectors": 10}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_provider_manager():
    manager = MagicMock()
    manager.get_llm.return_value = MockLLM()
    manager.get_embedding.return_value = MockEmbedding()
    manager.get_vectordb.return_value = MockVectorDB()
    return manager


@pytest.fixture
def mock_db():
    db = MagicMock(spec=Database)
    db.save_run = AsyncMock()
    db.update_run = AsyncMock()
    db.save_event = AsyncMock()
    db.get_document = AsyncMock(return_value=None)
    return db


@pytest.fixture
def emitter():
    return EventEmitter()


@pytest.fixture
def engine(mock_provider_manager, emitter, mock_db):
    return PipelineEngine(
        provider_manager=mock_provider_manager,
        emitter=emitter,
        db=mock_db,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPipelineEngine:
    async def test_run_query_returns_result(self, engine):
        result = await engine.run_query(
            query="What is RAG?",
            collection="test_collection",
        )
        assert "run_id" in result
        assert result["answer"] == "The answer is 42."
        assert result["total_latency_ms"] > 0
        assert "chunks" in result

    async def test_emits_all_pipeline_events(self, engine, emitter):
        received_types = []

        async def handler(event):
            received_types.append(event.type.value)

        emitter.subscribe(handler)
        await engine.run_query(query="What is RAG?", collection="test_collection")

        expected = {
            "query_received",
            "query_embedded",
            "retrieval_done",
            "prompt_assembled",
            "generation_start",
            "generation_done",
            "pipeline_complete",
        }
        for event_type in expected:
            assert event_type in received_types, f"Missing event: {event_type}"

    async def test_persists_run_to_db(self, engine, mock_db):
        await engine.run_query(query="What is RAG?", collection="test_collection")

        mock_db.save_run.assert_called_once()
        mock_db.update_run.assert_called_once()
        assert mock_db.save_event.call_count >= 6

    async def test_run_query_stream(self, engine):
        tokens = []
        async for token in engine.run_query_stream(
            query="What is RAG?",
            collection="test_collection",
        ):
            tokens.append(token)

        assert "The " in tokens
        assert "42." in tokens
