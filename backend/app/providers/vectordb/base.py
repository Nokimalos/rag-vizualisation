from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, Any] = {}


class VectorDBProvider(ABC):
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def create_collection(self, collection: str) -> None: ...

    @abstractmethod
    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None: ...

    @abstractmethod
    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]: ...

    @abstractmethod
    async def delete_collection(self, collection: str) -> None: ...

    @abstractmethod
    async def get_stats(self, collection: str) -> dict[str, Any]: ...
