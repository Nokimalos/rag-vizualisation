from typing import Any

from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType
from app.processing.chunker import Chunk
from app.providers.embedding.base import EmbeddingProvider
from app.providers.vectordb.base import VectorDBProvider

EMBED_BATCH_SIZE = 32


class Embedder:
    def __init__(
        self,
        embedding_provider: EmbeddingProvider,
        vectordb_provider: VectorDBProvider,
        emitter: EventEmitter,
    ) -> None:
        self._embedding = embedding_provider
        self._vectordb = vectordb_provider
        self._emitter = emitter

    async def embed_and_store(
        self,
        chunks: list[Chunk],
        document_id: str,
        collection: str,
        metadatas: list[dict[str, Any]] | None = None,
        filename: str | None = None,
    ) -> dict[str, Any]:
        await self._vectordb.create_collection(collection)

        texts = [chunk.text for chunk in chunks]
        ids = [f"{document_id}_chunk_{chunk.index}" for chunk in chunks]
        if metadatas is None:
            metadatas = [
                {
                    "document_id": document_id,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    **({"filename": filename} if filename else {}),
                }
                for chunk in chunks
            ]

        dimensions = self._embedding.dimensions()
        total_usage: dict[str, int] = {}

        # Embed and store in batches
        for batch_start in range(0, len(chunks), EMBED_BATCH_SIZE):
            batch_end = min(batch_start + EMBED_BATCH_SIZE, len(chunks))
            batch_texts = texts[batch_start:batch_end]
            batch_ids = ids[batch_start:batch_end]
            batch_metas = metadatas[batch_start:batch_end]

            # Embed this batch
            embed_result = await self._embedding.embed(batch_texts)
            embeddings = embed_result["embeddings"]
            usage = embed_result.get("usage", {})
            for k, v in usage.items():
                total_usage[k] = total_usage.get(k, 0) + (v if isinstance(v, int) else 0)

            # Store this batch
            await self._vectordb.add_documents(
                collection,
                batch_ids,
                batch_texts,
                embeddings,
                batch_metas,
            )

            # Emit progress
            await self._emitter.emit(
                PipelineEvent(
                    type=PipelineEventType.CHUNK_EMBEDDED,
                    step=batch_end,
                    total_steps=len(chunks),
                    data={
                        "document_id": document_id,
                        "batch": f"{batch_start}-{batch_end}",
                        "progress": f"{batch_end}/{len(chunks)}",
                    },
                )
            )

        await self._emitter.emit(
            PipelineEvent(
                type=PipelineEventType.INDEXING_DONE,
                step=len(chunks),
                total_steps=len(chunks),
                data={
                    "document_id": document_id,
                    "collection": collection,
                    "num_embedded": len(chunks),
                },
            )
        )

        return {
            "num_embedded": len(chunks),
            "dimensions": dimensions,
            "usage": total_usage,
        }
