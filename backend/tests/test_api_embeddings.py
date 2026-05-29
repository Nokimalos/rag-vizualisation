from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _make_mock_pm(col_data=None):
    """Build a mock ProviderManager with a vectordb that has _get_collection."""
    pm = MagicMock()
    mock_vectordb = MagicMock()

    if col_data is None:
        # _get_collection raises (no collection)
        mock_vectordb._get_collection = AsyncMock(side_effect=Exception("not found"))
    else:
        ids, documents, embeddings, metadatas = col_data
        mock_col = MagicMock()
        mock_col.get.return_value = {
            "ids": ids,
            "documents": documents,
            "embeddings": embeddings,
            "metadatas": metadatas,
        }
        mock_vectordb._get_collection = AsyncMock(return_value=mock_col)

    pm.get_vectordb.return_value = mock_vectordb
    return pm


class TestGetEmbeddings3D:
    async def test_empty_collection_returns_empty(self, client):
        mock_pm = _make_mock_pm(col_data=None)
        with patch("app.api.routes.embeddings.get_provider_manager", return_value=mock_pm):
            response = await client.get("/api/embeddings/3d")
        assert response.status_code == 200
        assert response.json() == {"points": [], "total": 0}

    async def test_empty_ids_returns_empty(self, client):
        mock_pm = _make_mock_pm(col_data=([], [], [], []))
        with patch("app.api.routes.embeddings.get_provider_manager", return_value=mock_pm):
            response = await client.get("/api/embeddings/3d")
        assert response.status_code == 200
        assert response.json() == {"points": [], "total": 0}

    async def test_returns_3d_points_format(self, client):
        n = 5
        ids = [f"chunk_{i}" for i in range(n)]
        documents = [f"text {i}" for i in range(n)]
        embeddings = np.random.rand(n, 8).tolist()
        metadatas = [{"document_id": f"doc_{i}"} for i in range(n)]

        mock_pm = _make_mock_pm((ids, documents, embeddings, metadatas))

        with patch("app.api.routes.embeddings.get_provider_manager", return_value=mock_pm):
            response = await client.get("/api/embeddings/3d")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == n
        assert len(body["points"]) == n

        first = body["points"][0]
        assert "id" in first and "x" in first and "y" in first and "z" in first
        assert "text" in first and "metadata" in first
        assert first["id"] == "chunk_0"
        assert first["text"] == "text 0"

    async def test_custom_collection_query_param(self, client):
        mock_pm = _make_mock_pm(col_data=([], [], [], []))
        with patch("app.api.routes.embeddings.get_provider_manager", return_value=mock_pm):
            response = await client.get("/api/embeddings/3d?collection=mycol")
        assert response.status_code == 200
        mock_pm.get_vectordb()._get_collection.assert_called_with("mycol")

    async def test_large_set_uses_umap(self, client):
        n = 20
        ids = [f"chunk_{i}" for i in range(n)]
        documents = [f"text {i}" for i in range(n)]
        embeddings = np.random.rand(n, 8).tolist()
        metadatas = [{} for _ in range(n)]

        mock_pm = _make_mock_pm((ids, documents, embeddings, metadatas))
        mock_coords = np.zeros((n, 3))

        with patch("app.api.routes.embeddings.umap") as mock_umap:
            mock_reducer = MagicMock()
            mock_reducer.fit_transform.return_value = mock_coords
            mock_umap.UMAP.return_value = mock_reducer

            with patch("app.api.routes.embeddings.get_provider_manager", return_value=mock_pm):
                response = await client.get("/api/embeddings/3d")

        assert response.status_code == 200
        mock_umap.UMAP.assert_called_once_with(
            n_components=3,
            n_neighbors=min(15, n - 1),
            random_state=42,
        )
