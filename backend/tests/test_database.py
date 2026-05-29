import pytest
from app.db.database import Database


@pytest.fixture
async def db(tmp_path):
    db_path = str(tmp_path / "test.db")
    database = Database(db_path)
    await database.initialize()
    yield database
    await database.close()


class TestDatabase:
    async def test_initialize_creates_tables(self, db):
        rows = await db.fetch_all(
            "SELECT name FROM sqlite_master WHERE type='table'", ()
        )
        table_names = {row["name"] for row in rows}
        assert "documents" in table_names
        assert "pipeline_runs" in table_names
        assert "pipeline_events" in table_names

    async def test_save_and_get_document(self, db):
        await db.save_document(
            doc_id="doc_1",
            filename="test.pdf",
            file_type="pdf",
            size_bytes=1024,
            num_chunks=5,
        )
        doc = await db.get_document("doc_1")
        assert doc is not None
        assert doc["id"] == "doc_1"
        assert doc["filename"] == "test.pdf"
        assert doc["file_type"] == "pdf"
        assert doc["size_bytes"] == 1024
        assert doc["num_chunks"] == 5
        assert doc["uploaded_at"] is not None

    async def test_list_documents(self, db):
        await db.save_document("doc_a", "a.pdf", "pdf", 100, 2)
        await db.save_document("doc_b", "b.pdf", "pdf", 200, 3)
        docs = await db.list_documents()
        assert len(docs) == 2

    async def test_save_and_get_run(self, db):
        await db.save_run(run_id="run_1", query="What is RAG?")
        run = await db.get_run("run_1")
        assert run is not None
        assert run["query"] == "What is RAG?"
        assert run["status"] == "running"

    async def test_update_run(self, db):
        await db.save_run(run_id="run_2", query="Explain embeddings")
        await db.update_run(
            run_id="run_2",
            status="completed",
            answer="Embeddings are vectors.",
            total_latency_ms=123.45,
        )
        run = await db.get_run("run_2")
        assert run["status"] == "completed"
        assert run["answer"] == "Embeddings are vectors."
        assert run["total_latency_ms"] == pytest.approx(123.45)

    async def test_save_and_get_events(self, db):
        await db.save_run(run_id="run_3", query="test query")
        await db.save_event(
            run_id="run_3",
            event_type="query_received",
            step=1,
            total_steps=8,
            data={"text": "test query"},
        )
        await db.save_event(
            run_id="run_3",
            event_type="query_embedded",
            step=2,
            total_steps=8,
            data={"dimensions": 3},
        )
        events = await db.get_run_events("run_3")
        assert len(events) == 2
        assert events[0]["event_type"] == "query_received"
        assert events[0]["data"] == {"text": "test query"}
        assert events[1]["event_type"] == "query_embedded"
        assert events[1]["data"] == {"dimensions": 3}

    async def test_get_stats(self, db):
        await db.save_run("run_s1", "query 1")
        await db.update_run("run_s1", status="completed", total_latency_ms=100.0)
        await db.save_run("run_s2", "query 2")
        await db.update_run("run_s2", status="completed", total_latency_ms=200.0)
        await db.save_document("doc_stats", "stats.pdf", "pdf", 512, 4)

        stats = await db.get_stats()
        assert stats["total_runs"] == 2
        assert stats["avg_latency_ms"] == pytest.approx(150.0)
        assert stats["total_documents"] == 1
