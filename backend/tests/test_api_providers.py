import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestListProviders:
    async def test_list_providers_success(self, client):
        providers_data = {
            "llm": {"available": ["ollama"], "active": "ollama"},
            "embedding": {"available": ["ollama"], "active": "ollama"},
            "vectordb": {"available": ["chroma"], "active": "chroma"},
        }
        mock_pm = MagicMock()
        mock_pm.list_providers = MagicMock(return_value=providers_data)

        with patch("app.api.routes.providers.get_provider_manager", return_value=mock_pm):
            response = await client.get("/api/providers")

        assert response.status_code == 200
        body = response.json()
        assert "llm" in body
        assert "embedding" in body
        assert "vectordb" in body


class TestUpdateProviderConfig:
    async def test_update_llm_provider(self, client):
        mock_pm = MagicMock()
        mock_pm.set_active_llm = MagicMock()

        config = {
            "provider_type": "llm",
            "provider_name": "ollama",
            "model": "llama3",
            "settings": {},
        }

        with patch("app.api.routes.providers.get_provider_manager", return_value=mock_pm):
            response = await client.put("/api/providers/config", json=config)

        assert response.status_code == 200
        mock_pm.set_active_llm.assert_called_once_with("ollama")

    async def test_update_embedding_provider(self, client):
        mock_pm = MagicMock()
        mock_pm.set_active_embedding = MagicMock()

        config = {
            "provider_type": "embedding",
            "provider_name": "ollama",
            "model": None,
            "settings": {},
        }

        with patch("app.api.routes.providers.get_provider_manager", return_value=mock_pm):
            response = await client.put("/api/providers/config", json=config)

        assert response.status_code == 200
        mock_pm.set_active_embedding.assert_called_once_with("ollama")

    async def test_update_vectordb_provider(self, client):
        mock_pm = MagicMock()
        mock_pm.set_active_vectordb = MagicMock()

        config = {
            "provider_type": "vectordb",
            "provider_name": "chroma",
            "model": None,
            "settings": {},
        }

        with patch("app.api.routes.providers.get_provider_manager", return_value=mock_pm):
            response = await client.put("/api/providers/config", json=config)

        assert response.status_code == 200
        mock_pm.set_active_vectordb.assert_called_once_with("chroma")
