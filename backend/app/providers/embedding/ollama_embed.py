from typing import Any

import ollama

from app.providers.embedding.base import EmbeddingProvider


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434",
    ) -> None:
        self.model = model
        self.client = ollama.AsyncClient(host=base_url)

    def name(self) -> str:
        return "ollama"

    def dimensions(self) -> int:
        return 768

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self.client.embed(model=self.model, input=texts)
        embeddings = response["embeddings"]
        return {
            "embeddings": embeddings,
            "usage": {"total_tokens": len(texts)},
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        result = await self.embed([text])
        return {
            "embedding": result["embeddings"][0],
            "usage": result["usage"],
        }
