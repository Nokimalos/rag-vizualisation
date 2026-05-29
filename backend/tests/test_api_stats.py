from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestGetStats:
    async def test_get_stats_success(self, client):
        stats_data = {
            "total_runs": 10,
            "avg_latency_ms": 250.5,
            "total_documents": 5,
        }
        mock_db = MagicMock()
        mock_db.get_stats = AsyncMock(return_value=stats_data)

        with patch("app.api.routes.stats.get_db", return_value=mock_db):
            response = await client.get("/api/stats")

        assert response.status_code == 200
        body = response.json()
        assert body["total_runs"] == 10
        assert body["avg_latency_ms"] == 250.5
        assert body["total_documents"] == 5

    async def test_get_stats_empty_db(self, client):
        stats_data = {
            "total_runs": 0,
            "avg_latency_ms": 0.0,
            "total_documents": 0,
        }
        mock_db = MagicMock()
        mock_db.get_stats = AsyncMock(return_value=stats_data)

        with patch("app.api.routes.stats.get_db", return_value=mock_db):
            response = await client.get("/api/stats")

        assert response.status_code == 200
        body = response.json()
        assert body["total_runs"] == 0
