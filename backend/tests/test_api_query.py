from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestRunQuery:
    async def test_run_query_success(self, client):
        mock_pipeline = MagicMock()
        mock_pipeline.run_query = AsyncMock(
            return_value={
                "run_id": "run-123",
                "answer": "The answer is 42.",
                "total_latency_ms": 150.0,
                "chunks": [],
            }
        )

        with patch("app.api.routes.query.get_pipeline", return_value=mock_pipeline):
            response = await client.post(
                "/api/query", json={"text": "What is RAG?", "mode": "dashboard"}
            )

        assert response.status_code == 200
        body = response.json()
        assert body["run_id"] == "run-123"
        assert body["status"] == "completed"
        assert body["answer"] == "The answer is 42."

    async def test_run_query_missing_text(self, client):
        response = await client.post("/api/query", json={})
        assert response.status_code == 422


class TestGetRunHistory:
    async def test_get_run_history_found(self, client):
        run = {
            "id": "run-123",
            "query": "What is RAG?",
            "status": "completed",
            "answer": "42",
            "total_latency_ms": 100.0,
            "created_at": "2026-04-13T00:00:00+00:00",
        }
        events = [
            {
                "id": 1,
                "run_id": "run-123",
                "event_type": "query_received",
                "step": 1,
                "total_steps": 8,
                "data": {},
                "timestamp": "2026-04-13T00:00:00+00:00",
            }
        ]
        mock_db = MagicMock()
        mock_db.get_run = AsyncMock(return_value=run)
        mock_db.get_run_events = AsyncMock(return_value=events)

        with patch("app.api.routes.query.get_db", return_value=mock_db):
            response = await client.get("/api/query/run-123/history")

        assert response.status_code == 200
        body = response.json()
        assert body["run"]["id"] == "run-123"
        assert len(body["events"]) == 1

    async def test_get_run_history_not_found(self, client):
        mock_db = MagicMock()
        mock_db.get_run = AsyncMock(return_value=None)
        mock_db.get_run_events = AsyncMock(return_value=[])

        with patch("app.api.routes.query.get_db", return_value=mock_db):
            response = await client.get("/api/query/nonexistent/history")

        assert response.status_code == 404
