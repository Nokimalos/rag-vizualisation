import asyncio
import json
import re
from typing import Any

try:
    import psycopg2
    import psycopg2.extras

    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False

from app.providers.vectordb.base import SearchResult, VectorDBProvider


class PgVectorDBProvider(VectorDBProvider):
    def __init__(self, connection_string: str, vector_size: int = 1536) -> None:
        if not _PSYCOPG2_AVAILABLE:
            raise ImportError(
                "psycopg2 is required for PgVectorDBProvider. "
                "Install it with: pip install psycopg2-binary"
            )
        self._connection_string = connection_string
        self._vector_size = vector_size
        self._conn = psycopg2.connect(connection_string)
        self._conn.autocommit = True
        with self._conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

    def name(self) -> str:
        return "pgvector"

    def _table_name(self, collection: str) -> str:
        sanitized = collection.replace("-", "_").replace(" ", "_")
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", sanitized):
            raise ValueError(f"Invalid collection name: {collection!r}")
        return sanitized

    async def create_collection(self, collection: str) -> None:
        table = self._table_name(collection)
        vector_size = self._vector_size

        def _run():
            with self._conn.cursor() as cur:
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {table} (
                        id TEXT PRIMARY KEY,
                        text TEXT,
                        embedding vector({vector_size}),
                        metadata JSONB
                    )
                    """
                )

        await asyncio.to_thread(_run)

    async def add_documents(
        self,
        collection: str,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        table = self._table_name(collection)

        def _run():
            with self._conn.cursor() as cur:
                for i, chunk_id in enumerate(ids):
                    meta = metadatas[i] if metadatas and i < len(metadatas) else {}
                    cur.execute(
                        f"""
                        INSERT INTO {table} (id, text, embedding, metadata)
                        VALUES (%s, %s, %s::vector, %s)
                        ON CONFLICT (id) DO UPDATE
                            SET text = EXCLUDED.text,
                                embedding = EXCLUDED.embedding,
                                metadata = EXCLUDED.metadata
                        """,
                        (chunk_id, texts[i], str(embeddings[i]), json.dumps(meta)),
                    )

        await asyncio.to_thread(_run)

    async def search(
        self,
        collection: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        table = self._table_name(collection)

        def _run():
            with self._conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT id, text, metadata, 1 - (embedding <=> %s::vector) AS score
                    FROM {table}
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (str(query_embedding), str(query_embedding), top_k),
                )
                return cur.fetchall()

        rows = await asyncio.to_thread(_run)

        results: list[SearchResult] = []
        for row in rows:
            chunk_id, text, metadata, score = row
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            results.append(
                SearchResult(
                    chunk_id=chunk_id,
                    text=text,
                    score=float(score),
                    metadata=metadata or {},
                )
            )
        return results

    async def delete_collection(self, collection: str) -> None:
        table = self._table_name(collection)

        def _run():
            with self._conn.cursor() as cur:
                cur.execute(f"DROP TABLE IF EXISTS {table}")

        await asyncio.to_thread(_run)

    async def get_stats(self, collection: str) -> dict[str, Any]:
        table = self._table_name(collection)

        def _run():
            with self._conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                return cur.fetchone()[0]

        count = await asyncio.to_thread(_run)
        return {
            "collection": collection,
            "total_vectors": count,
        }
