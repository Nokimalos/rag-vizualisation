from abc import ABC, abstractmethod
from typing import Any


class EmbeddingProvider(ABC):
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> dict[str, Any]:
        """Returns {"embeddings": list[list[float]], "usage": {"total_tokens": int}}"""
        ...

    @abstractmethod
    async def embed_query(self, text: str) -> dict[str, Any]:
        """Returns {"embedding": list[float], "usage": {"total_tokens": int}}"""
        ...

    @abstractmethod
    def dimensions(self) -> int: ...
