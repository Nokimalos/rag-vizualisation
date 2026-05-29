import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.vectordb.base import VectorDBProvider, SearchResult


# ---------------------------------------------------------------------------
# 1. ABC enforcement
# ---------------------------------------------------------------------------

class TestCannotInstantiateBase:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            VectorDBProvider()  # type: ignore[abstract]


# ---------------------------------------------------------------------------
# 2. SearchResult model
# ---------------------------------------------------------------------------

class TestSearchResult:
    def test_search_result_creation(self):
        result = SearchResult(chunk_id="abc", text="hello", score=0.9)
        assert result.chunk_id == "abc"
        assert result.text == "hello"
        assert result.score == 0.9
        assert result.metadata == {}

    def test_search_result_with_metadata(self):
        result = SearchResult(
            chunk_id="xyz",
            text="world",
            score=0.75,
            metadata={"source": "doc1", "page": 3},
        )
        assert result.metadata == {"source": "doc1", "page": 3}


# ---------------------------------------------------------------------------
# 3. ChromaDB Provider
# ---------------------------------------------------------------------------

class TestChromaDBProvider:
    def _make_provider(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
        return provider, mock_client

    def test_name(self):
        with patch("app.providers.vectordb.chroma_db.chromadb"):
            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            assert provider.name() == "chromadb"

    @pytest.mark.asyncio
    async def test_create_collection(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            mock_col = MagicMock()
            mock_client.get_or_create_collection.return_value = mock_col

            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            await provider.create_collection("test_col")

        mock_client.get_or_create_collection.assert_called_once_with(
            "test_col", metadata={"hnsw:space": "cosine"}
        )
        assert "test_col" in provider._collections

    @pytest.mark.asyncio
    async def test_add_documents(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            mock_col = MagicMock()
            mock_client.get_or_create_collection.return_value = mock_col

            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            await provider.create_collection("test_col")

            ids = ["id1", "id2"]
            texts = ["text one", "text two"]
            embeddings = [[0.1, 0.2], [0.3, 0.4]]
            metadatas = [{"src": "a"}, {"src": "b"}]

            await provider.add_documents("test_col", ids, texts, embeddings, metadatas)

        mock_col.add.assert_called_once_with(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    @pytest.mark.asyncio
    async def test_search_returns_results_with_score_conversion(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            mock_col = MagicMock()
            mock_client.get_or_create_collection.return_value = mock_col

            # Chroma returns distances; score = 1.0 - distance
            mock_col.query.return_value = {
                "ids": [["id1", "id2"]],
                "documents": [["doc one", "doc two"]],
                "distances": [[0.1, 0.3]],
                "metadatas": [[{"src": "a"}, {"src": "b"}]],
            }

            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            await provider.create_collection("test_col")

            query_embedding = [0.5, 0.6]
            results = await provider.search("test_col", query_embedding, top_k=2)

        assert len(results) == 2
        assert results[0].chunk_id == "id1"
        assert results[0].text == "doc one"
        assert pytest.approx(results[0].score) == 0.9  # 1.0 - 0.1
        assert results[1].chunk_id == "id2"
        assert pytest.approx(results[1].score) == 0.7  # 1.0 - 0.3

        mock_col.query.assert_called_once_with(
            query_embeddings=[query_embedding],
            n_results=2,
        )

    @pytest.mark.asyncio
    async def test_get_stats(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            mock_col = MagicMock()
            mock_col.count.return_value = 42
            mock_client.get_or_create_collection.return_value = mock_col

            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            await provider.create_collection("test_col")

            stats = await provider.get_stats("test_col")

        assert stats == {"collection": "test_col", "total_vectors": 42}

    @pytest.mark.asyncio
    async def test_delete_collection(self):
        with patch("app.providers.vectordb.chroma_db.chromadb") as mock_chroma:
            mock_client = MagicMock()
            mock_chroma.PersistentClient.return_value = mock_client
            mock_col = MagicMock()
            mock_client.get_or_create_collection.return_value = mock_col

            from app.providers.vectordb.chroma_db import ChromaDBProvider
            provider = ChromaDBProvider(path="./test_chroma")
            await provider.create_collection("test_col")
            assert "test_col" in provider._collections

            await provider.delete_collection("test_col")

        mock_client.delete_collection.assert_called_once_with("test_col")
        assert "test_col" not in provider._collections
