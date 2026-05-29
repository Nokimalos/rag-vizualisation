import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestListDocuments:
    async def test_list_documents_empty(self, client):
        mock_db = MagicMock()
        mock_db.list_documents = AsyncMock(return_value=[])

        with patch("app.api.routes.documents.get_db", return_value=mock_db):
            response = await client.get("/api/documents")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_documents_returns_items(self, client):
        doc = {
            "id": "abc",
            "filename": "test.txt",
            "file_type": "txt",
            "size_bytes": 100,
            "num_chunks": 3,
            "uploaded_at": "2026-04-13T00:00:00+00:00",
        }
        mock_db = MagicMock()
        mock_db.list_documents = AsyncMock(return_value=[doc])

        with patch("app.api.routes.documents.get_db", return_value=mock_db):
            response = await client.get("/api/documents")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == "test.txt"


class TestUploadDocument:
    async def test_upload_unsupported_format(self, client):
        content = b"some data"
        files = {"file": ("test.xyz", io.BytesIO(content), "application/octet-stream")}
        response = await client.post("/api/documents/upload", files=files)
        assert response.status_code == 400
        assert "unsupported" in response.json()["detail"].lower()

    async def test_upload_supported_format(self, client):
        content = b"Hello world, this is a test document."
        files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
        data = {"collection": "default"}

        mock_db = MagicMock()
        mock_db.save_document = AsyncMock()

        mock_embed_provider = MagicMock()
        mock_embed_provider.embed = AsyncMock(
            return_value={"embeddings": [[0.1, 0.2]], "usage": {}}
        )
        mock_embed_provider.dimensions = MagicMock(return_value=2)

        mock_vdb_provider = MagicMock()
        mock_vdb_provider.create_collection = AsyncMock()
        mock_vdb_provider.add_documents = AsyncMock()

        mock_pm = MagicMock()
        mock_pm.get_embedding = MagicMock(return_value=mock_embed_provider)
        mock_pm.get_vectordb = MagicMock(return_value=mock_vdb_provider)

        mock_emitter = MagicMock()
        mock_emitter.emit = AsyncMock()

        with (
            patch("app.api.routes.documents.get_db", return_value=mock_db),
            patch("app.api.routes.documents.get_provider_manager", return_value=mock_pm),
            patch("app.api.routes.documents.get_emitter", return_value=mock_emitter),
        ):
            response = await client.post("/api/documents/upload", files=files, data=data)

        assert response.status_code == 200
        body = response.json()
        assert body["filename"] == "test.txt"
        assert body["file_type"] == "txt"
        assert "id" in body
        assert "num_chunks" in body
