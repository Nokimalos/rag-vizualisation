import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.embedding.base import EmbeddingProvider
from app.providers.embedding.openai_embed import OpenAIEmbeddingProvider
from app.providers.embedding.cohere_embed import CohereEmbeddingProvider
from app.providers.embedding.ollama_embed import OllamaEmbeddingProvider


# ---------------------------------------------------------------------------
# 1. ABC enforcement
# ---------------------------------------------------------------------------

class TestCannotInstantiateBase:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            EmbeddingProvider()  # type: ignore[abstract]


# ---------------------------------------------------------------------------
# 2. OpenAI Embedding Provider
# ---------------------------------------------------------------------------

class TestOpenAIEmbeddingProvider:
    def test_provider_name(self):
        provider = OpenAIEmbeddingProvider(api_key="fake-key")
        assert provider.name() == "openai"

    def test_dimensions_small(self):
        provider = OpenAIEmbeddingProvider(api_key="fake-key", model="text-embedding-3-small")
        assert provider.dimensions() == 1536

    def test_dimensions_large(self):
        provider = OpenAIEmbeddingProvider(api_key="fake-key", model="text-embedding-3-large")
        assert provider.dimensions() == 3072

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = OpenAIEmbeddingProvider(api_key="fake-key")

        vec1 = [0.1, 0.2, 0.3]
        vec2 = [0.4, 0.5, 0.6]

        mock_data_0 = MagicMock()
        mock_data_0.embedding = vec1
        mock_data_1 = MagicMock()
        mock_data_1.embedding = vec2

        mock_usage = MagicMock()
        mock_usage.total_tokens = 8

        mock_response = MagicMock()
        mock_response.data = [mock_data_0, mock_data_1]
        mock_response.usage = mock_usage

        mock_create = AsyncMock(return_value=mock_response)

        with patch.object(provider.client.embeddings, "create", mock_create):
            result = await provider.embed(["hello", "world"])

        assert result["embeddings"] == [vec1, vec2]
        assert result["usage"]["total_tokens"] == 8

    @pytest.mark.asyncio
    async def test_embed_query(self):
        provider = OpenAIEmbeddingProvider(api_key="fake-key")

        vec = [0.1, 0.2, 0.3]

        mock_data_0 = MagicMock()
        mock_data_0.embedding = vec

        mock_usage = MagicMock()
        mock_usage.total_tokens = 4

        mock_response = MagicMock()
        mock_response.data = [mock_data_0]
        mock_response.usage = mock_usage

        mock_create = AsyncMock(return_value=mock_response)

        with patch.object(provider.client.embeddings, "create", mock_create):
            result = await provider.embed_query("hello")

        assert result["embedding"] == vec
        assert result["usage"]["total_tokens"] == 4


# ---------------------------------------------------------------------------
# 3. Cohere Embedding Provider
# ---------------------------------------------------------------------------

class TestCohereEmbeddingProvider:
    def test_provider_name(self):
        provider = CohereEmbeddingProvider(api_key="fake-key")
        assert provider.name() == "cohere"

    def test_dimensions(self):
        provider = CohereEmbeddingProvider(api_key="fake-key")
        assert provider.dimensions() == 1024

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = CohereEmbeddingProvider(api_key="fake-key")

        vec1 = [0.1, 0.2, 0.3]
        vec2 = [0.4, 0.5, 0.6]

        mock_embeddings = MagicMock()
        mock_embeddings.float_ = [vec1, vec2]

        mock_meta = MagicMock()
        mock_meta.billed_units.input_tokens = 10

        mock_response = MagicMock()
        mock_response.embeddings = mock_embeddings
        mock_response.meta = mock_meta

        mock_embed = AsyncMock(return_value=mock_response)

        with patch.object(provider.client, "embed", mock_embed):
            result = await provider.embed(["hello", "world"])

        assert result["embeddings"] == [vec1, vec2]
        assert result["usage"]["total_tokens"] == 10

        call_kwargs = mock_embed.call_args
        assert call_kwargs.kwargs.get("input_type") == "search_document"

    @pytest.mark.asyncio
    async def test_embed_query(self):
        provider = CohereEmbeddingProvider(api_key="fake-key")

        vec = [0.1, 0.2, 0.3]

        mock_embeddings = MagicMock()
        mock_embeddings.float_ = [vec]

        mock_meta = MagicMock()
        mock_meta.billed_units.input_tokens = 5

        mock_response = MagicMock()
        mock_response.embeddings = mock_embeddings
        mock_response.meta = mock_meta

        mock_embed = AsyncMock(return_value=mock_response)

        with patch.object(provider.client, "embed", mock_embed):
            result = await provider.embed_query("hello")

        assert result["embedding"] == vec
        assert result["usage"]["total_tokens"] == 5

        call_kwargs = mock_embed.call_args
        assert call_kwargs.kwargs.get("input_type") == "search_query"


# ---------------------------------------------------------------------------
# 4. Ollama Embedding Provider
# ---------------------------------------------------------------------------

class TestOllamaEmbeddingProvider:
    def test_provider_name(self):
        provider = OllamaEmbeddingProvider()
        assert provider.name() == "ollama"

    def test_dimensions(self):
        provider = OllamaEmbeddingProvider()
        assert provider.dimensions() == 768

    @pytest.mark.asyncio
    async def test_embed_texts(self):
        provider = OllamaEmbeddingProvider()

        vec1 = [0.1, 0.2, 0.3]
        vec2 = [0.4, 0.5, 0.6]

        mock_response = {"embeddings": [vec1, vec2]}

        mock_embed = AsyncMock(return_value=mock_response)

        with patch.object(provider.client, "embed", mock_embed):
            result = await provider.embed(["hello", "world"])

        assert result["embeddings"] == [vec1, vec2]
        assert result["usage"]["total_tokens"] == 2

    @pytest.mark.asyncio
    async def test_embed_query(self):
        provider = OllamaEmbeddingProvider()

        vec = [0.1, 0.2, 0.3]

        mock_response = {"embeddings": [vec]}

        mock_embed = AsyncMock(return_value=mock_response)

        with patch.object(provider.client, "embed", mock_embed):
            result = await provider.embed_query("hello")

        assert result["embedding"] == vec
        assert result["usage"]["total_tokens"] == 1
