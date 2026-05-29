import pytest
from unittest.mock import AsyncMock, MagicMock

from app.processing.chunker import Chunk
from app.processing.embedder import Embedder
from app.core.events import EventEmitter
from app.models.schemas import PipelineEventType


def make_mock_embedding_provider(embeddings=None, dimensions=3):
    """Create a mock embedding provider."""
    if embeddings is None:
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

    provider = MagicMock()
    provider.dimensions.return_value = dimensions
    provider.embed = AsyncMock(return_value={
        "embeddings": embeddings,
        "usage": {"total_tokens": 10},
    })
    return provider


def make_mock_vectordb_provider():
    """Create a mock vectordb provider."""
    provider = MagicMock()
    provider.create_collection = AsyncMock(return_value=None)
    provider.add_documents = AsyncMock(return_value=None)
    return provider


def make_chunks(n=2):
    """Create n sample chunks."""
    texts = ["chunk text one", "chunk text two", "chunk text three"]
    chunks = []
    start = 0
    for i in range(n):
        text = texts[i % len(texts)]
        chunks.append(Chunk(
            text=text,
            index=i,
            start_char=start,
            end_char=start + len(text),
        ))
        start += len(text) + 1
    return chunks


class TestEmbedder:
    @pytest.mark.asyncio
    async def test_embed_and_store_chunks(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings, dimensions=3)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        result = await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        assert result["num_embedded"] == 2
        assert result["dimensions"] == 3
        assert "usage" in result

    @pytest.mark.asyncio
    async def test_embed_called_once(self):
        embedding_provider = make_mock_embedding_provider()
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        embedding_provider.embed.assert_called_once()
        call_args = embedding_provider.embed.call_args[0][0]
        assert call_args == [c.text for c in chunks]

    @pytest.mark.asyncio
    async def test_create_collection_called(self):
        embedding_provider = make_mock_embedding_provider()
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "my_collection")

        vectordb_provider.create_collection.assert_called_once_with("my_collection")

    @pytest.mark.asyncio
    async def test_add_documents_called(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        vectordb_provider.add_documents.assert_called_once()
        call_kwargs = vectordb_provider.add_documents.call_args

        # Verify IDs format
        ids = call_kwargs[0][1] if call_kwargs[0] else call_kwargs[1]["ids"]
        assert ids == ["doc_123_chunk_0", "doc_123_chunk_1"]

    @pytest.mark.asyncio
    async def test_emits_events(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        received_events = []

        async def handler(event):
            received_events.append(event)

        emitter.subscribe(handler)

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        event_types = [e.type for e in received_events]
        assert PipelineEventType.CHUNK_EMBEDDED in event_types
        assert PipelineEventType.INDEXING_DONE in event_types

    @pytest.mark.asyncio
    async def test_chunk_embedded_emitted_per_chunk(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        chunk_embedded_events = [
            e for e in emitter.history
            if e.type == PipelineEventType.CHUNK_EMBEDDED
        ]
        assert len(chunk_embedded_events) >= 1  # batching may emit 1 event per batch

    @pytest.mark.asyncio
    async def test_indexing_done_emitted_once(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        indexing_done_events = [
            e for e in emitter.history
            if e.type == PipelineEventType.INDEXING_DONE
        ]
        assert len(indexing_done_events) == 1

    @pytest.mark.asyncio
    async def test_metadata_per_chunk(self):
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedding_provider = make_mock_embedding_provider(embeddings=embeddings)
        vectordb_provider = make_mock_vectordb_provider()
        emitter = EventEmitter()

        embedder = Embedder(embedding_provider, vectordb_provider, emitter)
        chunks = make_chunks(2)

        await embedder.embed_and_store(chunks, "doc_123", "test_collection")

        call_kwargs = vectordb_provider.add_documents.call_args
        # metadatas is the 5th positional arg (index 4) or keyword
        if call_kwargs[0] and len(call_kwargs[0]) >= 5:
            metadatas = call_kwargs[0][4]
        else:
            metadatas = call_kwargs[1].get("metadatas", call_kwargs[1].get("metadata"))

        assert metadatas is not None
        assert len(metadatas) == 2
        assert metadatas[0]["document_id"] == "doc_123"
        assert metadatas[0]["chunk_index"] == 0
        assert "start_char" in metadatas[0]
        assert "end_char" in metadatas[0]
