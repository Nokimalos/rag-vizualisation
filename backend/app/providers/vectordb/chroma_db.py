import asyncio
from typing import Any

import chromadb

from app.providers.vectordb.base import SearchResult, VectorDBProvider


class ChromaDBProvider(VectorDBProvider):
    def __init__(self, path: str = "./chroma_db") -> None:
        self._client = chromadb.PersistentClient(path=path)
        self._collections: dict[str, Any] = {}

    def name(self) -> str:
        return "chromadb"

    async def _get_collection(self, collection: str) -> Any:
        """Get collection from cache or load from disk."""
        if collection not in self._collections:
            col = await asyncio.to_thread(
                self._client.get_or_create_collection,
                collection,
                metadata={"hnsw:space": "cosine"},
            )
            self._collections[collection] = col
        return self._collections[collection]

    async def create_collection(self, collection: str) -> None:
        col = await asyncio.to_thread(
            self._client.get_or_create_collection,
            collection,
            metadata={"hnsw:space": "cosine"},
        )
        self._collections[collection] = col

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        col = await self._get_collection(collection)
        await asyncio.to_thread(
            col.add,
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        col = await self._get_collection(collection)
        raw = await asyncio.to_thread(
            col.query,
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
        results: list[SearchResult] = []
        ids = raw["ids"][0]
        documents = raw["documents"][0]
        distances = raw["distances"][0]
        metadatas = raw.get("metadatas", [[]])[0]

        for i, chunk_id in enumerate(ids):
            score = 1.0 - distances[i]
            meta = metadatas[i] if metadatas else {}
            results.append(
                SearchResult(
                    chunk_id=chunk_id,
                    text=documents[i],
                    score=score,
                    metadata=meta or {},
                )
            )
        return results

    async def delete_collection(self, collection: str) -> None:
        await asyncio.to_thread(self._client.delete_collection, collection)
        self._collections.pop(collection, None)

    async def get_stats(self, collection: str) -> dict[str, Any]:
        col = await self._get_collection(collection)
        count = await asyncio.to_thread(col.count)
        return {
            "collection": collection,
            "total_vectors": count,
        }
