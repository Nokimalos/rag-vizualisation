import json
from datetime import datetime, timezone
from typing import Any

import aiosqlite


class Database:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        self._conn = await aiosqlite.connect(self._db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                collection TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                num_chunks INTEGER DEFAULT 0,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                answer TEXT,
                total_latency_ms REAL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pipeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                step INTEGER NOT NULL,
                total_steps INTEGER NOT NULL,
                data TEXT DEFAULT '{}',
                timestamp TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
            );
        """)
        await self._conn.commit()

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    async def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
        async with self._conn.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    # --- Projects ---

    async def create_project(self, project_id: str, name: str, description: str = "") -> None:
        now = datetime.now(timezone.utc).isoformat()
        collection = f"proj_{project_id[:8]}"
        await self._conn.execute(
            "INSERT INTO projects (id, name, description, collection, created_at) VALUES (?, ?, ?, ?, ?)",
            (project_id, name, description, collection, now),
        )
        await self._conn.commit()

    async def list_projects(self) -> list[dict]:
        return await self.fetch_all("SELECT * FROM projects ORDER BY created_at DESC")

    async def get_project(self, project_id: str) -> dict | None:
        rows = await self.fetch_all("SELECT * FROM projects WHERE id = ?", (project_id,))
        return rows[0] if rows else None

    async def delete_project(self, project_id: str) -> None:
        await self._conn.execute("DELETE FROM documents WHERE project_id = ?", (project_id,))
        await self._conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await self._conn.commit()

    # --- Documents ---

    async def save_document(
        self,
        doc_id: str,
        filename: str,
        file_type: str,
        size_bytes: int,
        num_chunks: int,
        project_id: str | None = None,
    ) -> None:
        uploaded_at = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            "INSERT INTO documents (id, project_id, filename, file_type, size_bytes, num_chunks, uploaded_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (doc_id, project_id, filename, file_type, size_bytes, num_chunks, uploaded_at),
        )
        await self._conn.commit()

    async def delete_document(self, doc_id: str) -> None:
        await self._conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        await self._conn.commit()

    async def get_document(self, doc_id: str) -> dict | None:
        rows = await self.fetch_all(
            "SELECT * FROM documents WHERE id = ?", (doc_id,)
        )
        return rows[0] if rows else None

    async def list_documents(self, project_id: str | None = None) -> list[dict]:
        if project_id:
            return await self.fetch_all(
                "SELECT * FROM documents WHERE project_id = ? ORDER BY uploaded_at DESC", (project_id,)
            )
        return await self.fetch_all(
            "SELECT * FROM documents ORDER BY uploaded_at DESC", ()
        )

    async def save_run(self, run_id: str, query: str) -> None:
        created_at = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            "INSERT INTO pipeline_runs (id, query, status, created_at) VALUES (?, ?, 'running', ?)",
            (run_id, query, created_at),
        )
        await self._conn.commit()

    async def list_runs(self, limit: int = 20) -> list[dict]:
        return await self.fetch_all(
            "SELECT id, query, status, total_latency_ms, created_at FROM pipeline_runs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )

    async def get_run(self, run_id: str) -> dict | None:
        rows = await self.fetch_all(
            "SELECT * FROM pipeline_runs WHERE id = ?", (run_id,)
        )
        return rows[0] if rows else None

    async def update_run(
        self,
        run_id: str,
        status: str | None = None,
        answer: str | None = None,
        total_latency_ms: float | None = None,
    ) -> None:
        fields: list[str] = []
        values: list[Any] = []

        if status is not None:
            fields.append("status = ?")
            values.append(status)
        if answer is not None:
            fields.append("answer = ?")
            values.append(answer)
        if total_latency_ms is not None:
            fields.append("total_latency_ms = ?")
            values.append(total_latency_ms)

        if not fields:
            return

        values.append(run_id)
        await self._conn.execute(
            f"UPDATE pipeline_runs SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        await self._conn.commit()

    async def save_event(
        self,
        run_id: str,
        event_type: str,
        step: int,
        total_steps: int,
        data: dict | None = None,
    ) -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        data_str = json.dumps(data if data is not None else {})
        await self._conn.execute(
            "INSERT INTO pipeline_events (run_id, event_type, step, total_steps, data, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, event_type, step, total_steps, data_str, timestamp),
        )
        await self._conn.commit()

    async def get_run_events(self, run_id: str) -> list[dict]:
        rows = await self.fetch_all(
            "SELECT * FROM pipeline_events WHERE run_id = ? ORDER BY id",
            (run_id,),
        )
        for row in rows:
            row["data"] = json.loads(row["data"])
        return rows

    async def get_stats(self) -> dict[str, Any]:
        run_rows = await self.fetch_all(
            "SELECT COUNT(*) as cnt, AVG(total_latency_ms) as avg_lat "
            "FROM pipeline_runs WHERE status = 'completed'",
            (),
        )
        doc_rows = await self.fetch_all(
            "SELECT COUNT(*) as cnt FROM documents", ()
        )
        total_runs = run_rows[0]["cnt"] if run_rows else 0
        avg_latency = run_rows[0]["avg_lat"] if run_rows else 0.0
        total_documents = doc_rows[0]["cnt"] if doc_rows else 0
        return {
            "total_runs": total_runs,
            "avg_latency_ms": avg_latency or 0.0,
            "total_documents": total_documents,
        }
