from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.providers.vectordb.base import SearchResult, VectorDBProvider


class QdrantDBProvider(VectorDBProvider):
    def __init__(self, url: str = "http://localhost:6333", vector_size: int = 1536) -> None:
        self._client = AsyncQdrantClient(url=url)
        self._vector_size = vector_size

    def name(self) -> str:
        return "qdrant"

    async def create_collection(self, collection: str) -> None:
        existing = await self._client.get_collections()
        names = [c.name for c in existing.collections]
        if collection not in names:
            await self._client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(
                    size=self._vector_size,
                    distance=Distance.COSINE,
                ),
            )

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        points = []
        for i, chunk_id in enumerate(ids):
            payload: dict[str, Any] = {"text": texts[i]}
            if metadatas and i < len(metadatas):
                payload.update(metadatas[i])
            points.append(
                PointStruct(
                    id=chunk_id,
                    vector=embeddings[i],
                    payload=payload,
                )
            )
        await self._client.upsert(collection_name=collection, points=points)

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        raw = await self._client.query_points(
            collection_name=collection,
            query=query_embedding,
            limit=top_k,
        )
        results: list[SearchResult] = []
        for point in raw.points:
            payload = point.payload or {}
            text = payload.get("text", "")
            metadata = {k: v for k, v in payload.items() if k != "text"}
            results.append(
                SearchResult(
                    chunk_id=str(point.id),
                    text=text,
                    score=point.score,
                    metadata=metadata,
                )
            )
        return results

    async def delete_collection(self, collection: str) -> None:
        await self._client.delete_collection(collection_name=collection)

    async def get_stats(self, collection: str) -> dict[str, Any]:
        info = await self._client.get_collection(collection_name=collection)
        return {
            "collection": collection,
            "total_vectors": info.points_count,
        }
