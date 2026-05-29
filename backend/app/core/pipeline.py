import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from app.core.events import EventEmitter
from app.db.database import Database
from app.models.schemas import PipelineEvent, PipelineEventType
from app.providers.manager import ProviderManager

TOTAL_STEPS = 8

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the user's question using the provided context. "
    "Use all relevant information from the context, even if it appears in different chunks. "
    "If the context truly contains no relevant information, say so. "
    "Answer in the same language as the question."
)

DEFAULT_PROMPT_TEMPLATE = (
    "Here are relevant excerpts from the knowledge base:\n\n"
    "{context}\n\n"
    "---\n\n"
    "Question: {query}\n\n"
    "Answer based on the above context:"
)


class PipelineEngine:
    def __init__(
        self,
        provider_manager: ProviderManager,
        emitter: EventEmitter,
        db: Database,
    ) -> None:
        self._provider_manager = provider_manager
        self._emitter = emitter
        self._db = db
        self.system_prompt = DEFAULT_SYSTEM_PROMPT
        self.prompt_template = DEFAULT_PROMPT_TEMPLATE

    async def _emit_and_persist(
        self,
        run_id: str,
        event_type: PipelineEventType,
        step: int,
        data: dict | None = None,
    ) -> None:
        if data is None:
            data = {}
        event = PipelineEvent(
            type=event_type,
            step=step,
            total_steps=TOTAL_STEPS,
            data=data,
        )
        await self._emitter.emit(event)
        await self._db.save_event(
            run_id=run_id,
            event_type=event_type.value,
            step=step,
            total_steps=TOTAL_STEPS,
            data=data,
        )

    async def _resolve_filenames(self, chunks: list) -> dict[str, str]:
        """Map document_id -> filename for the chunks, hitting DB only for missing ones."""
        filenames: dict[str, str] = {}
        missing_ids: set[str] = set()
        for chunk in chunks:
            metadata = getattr(chunk, "metadata", None) or {}
            doc_id = metadata.get("document_id")
            if not doc_id:
                continue
            if metadata.get("filename"):
                filenames[doc_id] = metadata["filename"]
            elif doc_id not in filenames:
                missing_ids.add(doc_id)

        for doc_id in missing_ids:
            doc = await self._db.get_document(doc_id)
            if doc and doc.get("filename"):
                filenames[doc_id] = doc["filename"]
        return filenames

    def _build_prompt(
        self, query: str, chunks: list, filenames: dict[str, str] | None = None
    ) -> str:
        filenames = filenames or {}
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            score = getattr(chunk, "score", None)
            metadata = getattr(chunk, "metadata", None) or {}
            doc_id = metadata.get("document_id")
            source = filenames.get(doc_id) if doc_id else None

            header_bits = [f"Excerpt {i}"]
            if source:
                header_bits.append(f"source: {source}")
            if score is not None:
                header_bits.append(f"relevance: {score:.0%}")
            header = f"[{' — '.join(header_bits)}]"
            context_parts.append(f"{header}\n{chunk.text}")
        context = "\n\n".join(context_parts)
        return self.prompt_template.format(context=context, query=query)

    async def run_query(
        self,
        query: str,
        collection: str,
        top_k: int = 10,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        run_id = str(uuid.uuid4())
        start_time = time.monotonic()

        await self._db.save_run(run_id=run_id, query=query)

        try:
            # Step 1: Query received
            await self._emit_and_persist(
                run_id, PipelineEventType.QUERY_RECEIVED, step=1, data={"query": query}
            )

            # Step 2: Embed query
            embedding_provider = self._provider_manager.get_embedding()
            embed_result = await embedding_provider.embed_query(query)
            query_embedding = embed_result["embedding"]
            await self._emit_and_persist(
                run_id,
                PipelineEventType.QUERY_EMBEDDED,
                step=2,
                data={"dimensions": len(query_embedding)},
            )

            # Step 3: Retrieve chunks
            vectordb_provider = self._provider_manager.get_vectordb()
            chunks = await vectordb_provider.search(
                collection=collection,
                query_embedding=query_embedding,
                top_k=top_k,
            )
            await self._emit_and_persist(
                run_id,
                PipelineEventType.RETRIEVAL_DONE,
                step=3,
                data={
                    "num_chunks": len(chunks),
                    "chunks": [
                        {"id": c.chunk_id, "text": c.text, "score": c.score} for c in chunks
                    ],
                },
            )

            # Step 4: Reranking (skipped)
            await self._emit_and_persist(
                run_id,
                PipelineEventType.RERANKING_DONE,
                step=4,
                data={"skipped": True},
            )

            # Step 5: Assemble prompt
            filenames = await self._resolve_filenames(chunks)
            prompt = self._build_prompt(query, chunks, filenames)
            await self._emit_and_persist(
                run_id,
                PipelineEventType.PROMPT_ASSEMBLED,
                step=5,
                data={"prompt_length": len(prompt), "chunks_injected": len(chunks)},
            )

            # Step 6: Generation start
            llm_provider = self._provider_manager.get_llm()
            await self._emit_and_persist(
                run_id,
                PipelineEventType.GENERATION_START,
                step=6,
                data={"model": llm_provider.name()},
            )

            # Generate response
            llm_result = await llm_provider.generate(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=self.system_prompt,
            )
            answer = llm_result["content"]

            # Step 7: Generation done
            await self._emit_and_persist(
                run_id,
                PipelineEventType.GENERATION_DONE,
                step=7,
                data={"answer_length": len(answer)},
            )

            # Step 8: Pipeline complete
            total_latency_ms = (time.monotonic() - start_time) * 1000.0
            await self._emit_and_persist(
                run_id,
                PipelineEventType.PIPELINE_COMPLETE,
                step=8,
                data={"total_latency_ms": total_latency_ms},
            )

            # Persist final run state
            await self._db.update_run(
                run_id=run_id,
                status="completed",
                answer=answer,
                total_latency_ms=total_latency_ms,
            )

        except Exception:
            total_latency_ms = (time.monotonic() - start_time) * 1000.0
            await self._emit_and_persist(
                run_id,
                PipelineEventType.STEP_FAILED,
                step=0,
                data={"error": "Pipeline failed"},
            )
            await self._db.update_run(
                run_id=run_id,
                status="failed",
                answer=None,
                total_latency_ms=total_latency_ms,
            )
            raise

        return {
            "run_id": run_id,
            "answer": answer,
            "total_latency_ms": total_latency_ms,
            "chunks": [
                {
                    "chunk_id": chunk.chunk_id,
                    "text": chunk.text,
                    "score": chunk.score,
                    "metadata": chunk.metadata,
                }
                for chunk in chunks
            ],
        }

    async def run_query_stream(
        self,
        query: str,
        collection: str,
        top_k: int = 10,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        run_id = str(uuid.uuid4())
        start_time = time.monotonic()

        await self._db.save_run(run_id=run_id, query=query)

        try:
            # Step 1: Query received
            await self._emit_and_persist(
                run_id, PipelineEventType.QUERY_RECEIVED, step=1, data={"query": query}
            )

            # Step 2: Embed query
            embedding_provider = self._provider_manager.get_embedding()
            embed_result = await embedding_provider.embed_query(query)
            query_embedding = embed_result["embedding"]
            await self._emit_and_persist(
                run_id,
                PipelineEventType.QUERY_EMBEDDED,
                step=2,
                data={"dimensions": len(query_embedding)},
            )

            # Step 3: Retrieve chunks
            vectordb_provider = self._provider_manager.get_vectordb()
            chunks = await vectordb_provider.search(
                collection=collection,
                query_embedding=query_embedding,
                top_k=top_k,
            )
            await self._emit_and_persist(
                run_id,
                PipelineEventType.RETRIEVAL_DONE,
                step=3,
                data={
                    "num_chunks": len(chunks),
                    "chunks": [
                        {"id": c.chunk_id, "text": c.text, "score": c.score} for c in chunks
                    ],
                },
            )

            # Step 4: Reranking (skipped)
            await self._emit_and_persist(
                run_id,
                PipelineEventType.RERANKING_DONE,
                step=4,
                data={"skipped": True},
            )

            # Step 5: Assemble prompt
            filenames = await self._resolve_filenames(chunks)
            prompt = self._build_prompt(query, chunks, filenames)
            await self._emit_and_persist(
                run_id,
                PipelineEventType.PROMPT_ASSEMBLED,
                step=5,
                data={"prompt_length": len(prompt), "chunks_injected": len(chunks)},
            )

            # Step 6: Generation start
            llm_provider = self._provider_manager.get_llm()
            await self._emit_and_persist(
                run_id,
                PipelineEventType.GENERATION_START,
                step=6,
                data={"model": llm_provider.name()},
            )

            # Stream generation (I2: TOKEN_GENERATED events are NOT persisted to DB)
            full_answer_parts: list[str] = []
            async for token in llm_provider.generate_stream(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=self.system_prompt,
            ):
                full_answer_parts.append(token)
                event = PipelineEvent(
                    type=PipelineEventType.TOKEN_GENERATED,
                    step=6,
                    total_steps=TOTAL_STEPS,
                    data={"token": token},
                )
                await self._emitter.emit(event)
                yield token

            answer = "".join(full_answer_parts)

            # Step 7: Generation done
            await self._emit_and_persist(
                run_id,
                PipelineEventType.GENERATION_DONE,
                step=7,
                data={"answer_length": len(answer)},
            )

            # Step 8: Pipeline complete
            total_latency_ms = (time.monotonic() - start_time) * 1000.0
            await self._emit_and_persist(
                run_id,
                PipelineEventType.PIPELINE_COMPLETE,
                step=8,
                data={"total_latency_ms": total_latency_ms},
            )

            # Persist final run state
            await self._db.update_run(
                run_id=run_id,
                status="completed",
                answer=answer,
                total_latency_ms=total_latency_ms,
            )

        except Exception:
            total_latency_ms = (time.monotonic() - start_time) * 1000.0
            await self._emit_and_persist(
                run_id,
                PipelineEventType.STEP_FAILED,
                step=0,
                data={"error": "Pipeline failed"},
            )
            await self._db.update_run(
                run_id=run_id,
                status="failed",
                answer=None,
                total_latency_ms=total_latency_ms,
            )
            raise
