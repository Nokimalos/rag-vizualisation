import pytest
from typing import Any, AsyncGenerator

from app.providers.llm.base import LLMProvider
from app.providers.embedding.base import EmbeddingProvider
from app.providers.vectordb.base import VectorDBProvider, SearchResult
from app.providers.manager import ProviderManager


# ---------------------------------------------------------------------------
# Minimal mock providers (implement all ABCs)
# ---------------------------------------------------------------------------

class MockLLMProvider(LLMProvider):
    def __init__(self, provider_name: str = "mock_llm"):
        self._name = provider_name

    def name(self) -> str:
        return self._name

    async def generate(self, prompt: str, temperature: float = 0.7,
                       max_tokens: int = 2048, system_prompt: str | None = None) -> dict[str, Any]:
        return {"content": "mock", "usage": {}}

    async def generate_stream(self, prompt: str, temperature: float = 0.7,
                               max_tokens: int = 2048, system_prompt: str | None = None) -> AsyncGenerator[str, None]:
        yield "mock"


class MockEmbeddingProvider(EmbeddingProvider):
    def __init__(self, provider_name: str = "mock_embed"):
        self._name = provider_name

    def name(self) -> str:
        return self._name

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        return {"embeddings": [[0.1] * 3] * len(texts), "usage": {"total_tokens": len(texts)}}

    async def embed_query(self, text: str) -> dict[str, Any]:
        return {"embedding": [0.1, 0.2, 0.3], "usage": {"total_tokens": 1}}

    def dimensions(self) -> int:
        return 3


class MockVectorDBProvider(VectorDBProvider):
    def __init__(self, provider_name: str = "mock_vectordb"):
        self._name = provider_name

    def name(self) -> str:
        return self._name

    async def create_collection(self, collection: str) -> None:
        pass

    async def add_documents(self, collection: str, ids: list[str], texts: list[str],
                             embeddings: list[list[float]], metadatas: list[dict[str, Any]] | None = None) -> None:
        pass

    async def search(self, collection: str, query_embedding: list[float],
                     top_k: int = 5) -> list[SearchResult]:
        return []

    async def delete_collection(self, collection: str) -> None:
        pass

    async def get_stats(self, collection: str) -> dict[str, Any]:
        return {}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRegisterAndGet:
    def test_register_and_get_llm(self):
        manager = ProviderManager()
        provider = MockLLMProvider("openai")
        manager.register_llm("openai", provider)
        manager.set_active_llm("openai")
        assert manager.get_llm() is provider

    def test_register_and_get_embedding(self):
        manager = ProviderManager()
        provider = MockEmbeddingProvider("cohere")
        manager.register_embedding("cohere", provider)
        manager.set_active_embedding("cohere")
        assert manager.get_embedding() is provider

    def test_register_and_get_vectordb(self):
        manager = ProviderManager()
        provider = MockVectorDBProvider("chromadb")
        manager.register_vectordb("chromadb", provider)
        manager.set_active_vectordb("chromadb")
        assert manager.get_vectordb() is provider


class TestGetUnsetProviderRaises:
    def test_get_llm_no_active_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="No active LLM provider"):
            manager.get_llm()

    def test_get_embedding_no_active_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="No active embedding provider"):
            manager.get_embedding()

    def test_get_vectordb_no_active_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="No active vectordb provider"):
            manager.get_vectordb()


class TestSetUnknownProviderRaises:
    def test_set_unknown_llm_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            manager.set_active_llm("nonexistent")

    def test_set_unknown_embedding_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="Unknown embedding provider"):
            manager.set_active_embedding("nonexistent")

    def test_set_unknown_vectordb_raises(self):
        manager = ProviderManager()
        with pytest.raises(ValueError, match="Unknown vectordb provider"):
            manager.set_active_vectordb("nonexistent")


class TestHotSwap:
    def test_hot_swap_llm(self):
        manager = ProviderManager()
        provider_a = MockLLMProvider("openai")
        provider_b = MockLLMProvider("anthropic")

        manager.register_llm("openai", provider_a)
        manager.register_llm("anthropic", provider_b)

        manager.set_active_llm("openai")
        assert manager.get_llm() is provider_a

        manager.set_active_llm("anthropic")
        assert manager.get_llm() is provider_b

    def test_hot_swap_embedding(self):
        manager = ProviderManager()
        provider_a = MockEmbeddingProvider("openai")
        provider_b = MockEmbeddingProvider("cohere")

        manager.register_embedding("openai", provider_a)
        manager.register_embedding("cohere", provider_b)

        manager.set_active_embedding("openai")
        assert manager.get_embedding() is provider_a

        manager.set_active_embedding("cohere")
        assert manager.get_embedding() is provider_b


class TestListProviders:
    def test_list_providers_empty(self):
        manager = ProviderManager()
        result = manager.list_providers()
        assert "llm" in result
        assert "embedding" in result
        assert "vectordb" in result
        assert result["llm"]["available"] == []
        assert result["llm"]["active"] is None
        assert result["embedding"]["available"] == []
        assert result["embedding"]["active"] is None
        assert result["vectordb"]["available"] == []
        assert result["vectordb"]["active"] is None

    def test_list_providers_with_registered(self):
        manager = ProviderManager()
        manager.register_llm("openai", MockLLMProvider("openai"))
        manager.register_llm("anthropic", MockLLMProvider("anthropic"))
        manager.set_active_llm("openai")

        manager.register_embedding("cohere", MockEmbeddingProvider("cohere"))
        manager.set_active_embedding("cohere")

        manager.register_vectordb("chromadb", MockVectorDBProvider("chromadb"))

        result = manager.list_providers()

        assert set(result["llm"]["available"]) == {"openai", "anthropic"}
        assert result["llm"]["active"] == "openai"

        assert result["embedding"]["available"] == ["cohere"]
        assert result["embedding"]["active"] == "cohere"

        assert result["vectordb"]["available"] == ["chromadb"]
        assert result["vectordb"]["active"] is None
