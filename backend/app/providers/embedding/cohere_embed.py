from typing import Any

import cohere

from app.providers.embedding.base import EmbeddingProvider


class CohereEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = "embed-v4.0") -> None:
        self.model = model
        self.client = cohere.AsyncClientV2(api_key=api_key)

    def name(self) -> str:
        return "cohere"

    def dimensions(self) -> int:
        return 1024

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self.client.embed(
            texts=texts,
            model=self.model,
            input_type="search_document",
            embedding_types=["float"],
        )
        embeddings = response.embeddings.float_
        total_tokens = response.meta.billed_units.input_tokens
        return {
            "embeddings": embeddings,
            "usage": {"total_tokens": total_tokens},
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        response = await self.client.embed(
            texts=[text],
            model=self.model,
            input_type="search_query",
            embedding_types=["float"],
        )
        embedding = response.embeddings.float_[0]
        total_tokens = response.meta.billed_units.input_tokens
        return {
            "embedding": embedding,
            "usage": {"total_tokens": total_tokens},
        }
