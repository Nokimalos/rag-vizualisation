"""
Integration test: Full ingest → query pipeline with a real Database,
real DocumentParser/Chunker/Embedder, and mock LLM/Embedding/VectorDB providers.
"""

import random
from collections.abc import AsyncGenerator
from typing import Any

import pytest

from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.models.schemas import ChunkingStrategy, PipelineEventType
from app.processing.chunker import Chunker
from app.processing.embedder import Embedder
from app.processing.parser import DocumentParser
from app.providers.manager import ProviderManager
from app.providers.vectordb.base import SearchResult

# ---------------------------------------------------------------------------
# Mock providers
# ---------------------------------------------------------------------------

MOCK_ANSWER = "Based on the context, RAG stands for Retrieval Augmented Generation."
EMBEDDING_DIM = 8


class MockLLMIntegration:
    def name(self) -> str:
        return "mock_llm"

    async def generate(self, prompt: str, **kwargs) -> dict[str, Any]:
        return {
            "content": MOCK_ANSWER,
            "usage": {"prompt_tokens": 20, "completion_tokens": 15, "total_tokens": 35},
        }

    async def generate_stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        for word in MOCK_ANSWER.split():
            yield word + " "


class MockEmbeddingIntegration:
    """Embedding provider that returns random but consistent 8-dim vectors."""

    def name(self) -> str:
        return "mock_embedding"

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        rng = random.Random(42)
        embeddings = [[rng.random() for _ in range(EMBEDDING_DIM)] for _ in texts]
        return {
            "embeddings": embeddings,
            "usage": {"total_tokens": len(texts)},
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        rng = random.Random(hash(text) & 0xFFFFFFFF)
        return {
            "embedding": [rng.random() for _ in range(EMBEDDING_DIM)],
            "usage": {"total_tokens": 1},
        }

    def dimensions(self) -> int:
        return EMBEDDING_DIM


class MockVectorDBIntegration:
    """In-memory vector store that stores and returns documents for search."""

    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}

    def name(self) -> str:
        return "mock_vectordb"

    async def create_collection(self, collection: str) -> None:
        pass

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        for i, doc_id in enumerate(ids):
            self._store[doc_id] = {
                "text": texts[i],
                "embedding": embeddings[i],
                "metadata": (metadatas[i] if metadatas else {}),
            }

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        results = []
        for chunk_id, entry in list(self._store.items())[:top_k]:
            results.append(
                SearchResult(
                    chunk_id=chunk_id,
                    text=entry["text"],
                    score=0.9,
                    metadata=entry["metadata"],
                )
            )
        return results

    async def delete_collection(self, collection: str) -> None:
        self._store.clear()

    async def get_stats(self, collection: str) -> dict[str, Any]:
        return {"total_vectors": len(self._store)}


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


class TestFullPipeline:
    @pytest.mark.asyncio
    async def test_ingest_then_query(self, tmp_path):
        # ------------------------------------------------------------------ #
        # Setup: real DB + real EventEmitter + mock providers
        # ------------------------------------------------------------------ #
        db_path = str(tmp_path / "test_integration.db")
        db = Database(db_path)
        await db.initialize()

        emitter = EventEmitter()
        received_event_types: list[str] = []

        async def capture_event(event):
            received_event_types.append(event.type.value)

        emitter.subscribe(capture_event)

        mock_llm = MockLLMIntegration()
        mock_embedding = MockEmbeddingIntegration()
        mock_vectordb = MockVectorDBIntegration()

        pm = ProviderManager()
        pm.register_llm("mock", mock_llm)
        pm.register_embedding("mock", mock_embedding)
        pm.register_vectordb("mock", mock_vectordb)
        pm.set_active_llm("mock")
        pm.set_active_embedding("mock")
        pm.set_active_vectordb("mock")

        pipeline = PipelineEngine(pm, emitter, db)

        # ------------------------------------------------------------------ #
        # Step 1: Create test .txt document
        # ------------------------------------------------------------------ #
        doc_content = (
            "RAG stands for Retrieval Augmented Generation. "
            "It is a technique that combines information retrieval with language models. "
            "RAG retrieves relevant documents from a knowledge base and uses them as context "
            "for generating answers. This approach improves accuracy and reduces hallucinations."
        )
        doc_path = tmp_path / "test_doc.txt"
        doc_path.write_text(doc_content, encoding="utf-8")

        # ------------------------------------------------------------------ #
        # Step 2: Parse with DocumentParser
        # ------------------------------------------------------------------ #
        parse_result = DocumentParser.parse(doc_path)
        assert parse_result.file_type == "txt"
        assert len(parse_result.text) > 0

        # ------------------------------------------------------------------ #
        # Step 3: Chunk with Chunker (chunk_size=100, overlap=20)
        # ------------------------------------------------------------------ #
        chunks = Chunker.chunk(
            text=parse_result.text,
            strategy=ChunkingStrategy.RECURSIVE,
            chunk_size=100,
            overlap=20,
        )
        assert len(chunks) > 0

        # ------------------------------------------------------------------ #
        # Step 4: Embed and store with Embedder
        # ------------------------------------------------------------------ #
        document_id = "test-doc-001"
        embedder = Embedder(mock_embedding, mock_vectordb, emitter)
        embed_result = await embedder.embed_and_store(
            chunks=chunks,
            document_id=document_id,
            collection="default",
        )
        assert embed_result["num_embedded"] == len(chunks)
        assert embed_result["dimensions"] == EMBEDDING_DIM

        # Save document record in DB
        await db.save_document(
            doc_id=document_id,
            filename="test_doc.txt",
            file_type="txt",
            size_bytes=len(doc_content.encode()),
            num_chunks=len(chunks),
        )

        # ------------------------------------------------------------------ #
        # Step 5: Run query "What is RAG?" through PipelineEngine
        # ------------------------------------------------------------------ #
        result = await pipeline.run_query(
            query="What is RAG?",
            collection="default",
        )

        # ------------------------------------------------------------------ #
        # Verify: result has expected fields
        # ------------------------------------------------------------------ #
        assert "run_id" in result
        assert result["answer"] == MOCK_ANSWER
        assert result["total_latency_ms"] > 0

        # ------------------------------------------------------------------ #
        # Verify: Events include required types
        # ------------------------------------------------------------------ #
        required_events = {
            PipelineEventType.QUERY_RECEIVED.value,
            PipelineEventType.QUERY_EMBEDDED.value,
            PipelineEventType.RETRIEVAL_DONE.value,
            PipelineEventType.GENERATION_DONE.value,
            PipelineEventType.PIPELINE_COMPLETE.value,
        }
        for event_type in required_events:
            assert event_type in received_event_types, (
                f"Missing event: {event_type}. Got: {received_event_types}"
            )

        # ------------------------------------------------------------------ #
        # Verify: DB has run with status=completed
        # ------------------------------------------------------------------ #
        run_id = result["run_id"]
        db_run = await db.get_run(run_id)
        assert db_run is not None
        assert db_run["status"] == "completed"
        assert db_run["answer"] == MOCK_ANSWER

        # ------------------------------------------------------------------ #
        # Verify: DB has >= 6 events
        # ------------------------------------------------------------------ #
        db_events = await db.get_run_events(run_id)
        assert len(db_events) >= 6, (
            f"Expected >= 6 DB events, got {len(db_events)}: {[e['event_type'] for e in db_events]}"
        )

        # ------------------------------------------------------------------ #
        # Cleanup
        # ------------------------------------------------------------------ #
        await db.close()

    @pytest.mark.asyncio
    async def test_query_result_contains_chunks(self, tmp_path):
        """Verify that query result includes retrieved chunks."""
        db_path = str(tmp_path / "test_chunks.db")
        db = Database(db_path)
        await db.initialize()

        emitter = EventEmitter()
        mock_llm = MockLLMIntegration()
        mock_embedding = MockEmbeddingIntegration()
        mock_vectordb = MockVectorDBIntegration()

        # Pre-populate the vector store
        doc_id = "pre-doc-001"
        await mock_vectordb.add_documents(
            collection="default",
            ids=[f"{doc_id}_chunk_0", f"{doc_id}_chunk_1"],
            texts=["RAG is retrieval augmented generation.", "It combines search and LLM."],
            embeddings=[[0.1] * EMBEDDING_DIM, [0.2] * EMBEDDING_DIM],
            metadatas=[{"document_id": doc_id}, {"document_id": doc_id}],
        )

        pm = ProviderManager()
        pm.register_llm("mock", mock_llm)
        pm.register_embedding("mock", mock_embedding)
        pm.register_vectordb("mock", mock_vectordb)
        pm.set_active_llm("mock")
        pm.set_active_embedding("mock")
        pm.set_active_vectordb("mock")

        pipeline = PipelineEngine(pm, emitter, db)
        result = await pipeline.run_query(query="What is RAG?", collection="default")

        assert "chunks" in result
        assert len(result["chunks"]) > 0

        first_chunk = result["chunks"][0]
        assert "chunk_id" in first_chunk
        assert "text" in first_chunk
        assert "score" in first_chunk

        await db.close()

    @pytest.mark.asyncio
    async def test_multiple_runs_accumulate_in_db(self, tmp_path):
        """Multiple pipeline runs are all persisted to the database."""
        db_path = str(tmp_path / "test_multi.db")
        db = Database(db_path)
        await db.initialize()

        emitter = EventEmitter()
        mock_llm = MockLLMIntegration()
        mock_embedding = MockEmbeddingIntegration()
        mock_vectordb = MockVectorDBIntegration()

        pm = ProviderManager()
        pm.register_llm("mock", mock_llm)
        pm.register_embedding("mock", mock_embedding)
        pm.register_vectordb("mock", mock_vectordb)
        pm.set_active_llm("mock")
        pm.set_active_embedding("mock")
        pm.set_active_vectordb("mock")

        pipeline = PipelineEngine(pm, emitter, db)

        queries = ["What is RAG?", "How does retrieval work?", "What is a vector database?"]
        run_ids = []
        for q in queries:
            result = await pipeline.run_query(query=q, collection="default")
            run_ids.append(result["run_id"])

        stats = await db.get_stats()
        assert stats["total_runs"] == len(queries)

        for run_id in run_ids:
            run = await db.get_run(run_id)
            assert run is not None
            assert run["status"] == "completed"

        await db.close()
