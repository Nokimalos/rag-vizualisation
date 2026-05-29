from typing import Any

import openai

from app.providers.embedding.base import EmbeddingProvider

_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        base_url: str | None = None,
    ) -> None:
        self.model = model
        self._base_url = base_url
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)

    def name(self) -> str:
        return "openai"

    def dimensions(self) -> int:
        return _DIMENSIONS.get(self.model, 1536)

    async def embed(self, texts: list[str]) -> dict[str, Any]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts,
        )
        embeddings = [item.embedding for item in response.data]
        return {
            "embeddings": embeddings,
            "usage": {"total_tokens": response.usage.total_tokens},
        }

    async def embed_query(self, text: str) -> dict[str, Any]:
        result = await self.embed([text])
        return {
            "embedding": result["embeddings"][0],
            "usage": result["usage"],
        }
