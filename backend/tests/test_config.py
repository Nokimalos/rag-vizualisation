import pytest
from app.core.config import Settings

class TestSettings:
    def test_default_values(self):
        settings = Settings(_env_file=None, UPLOAD_DIR="./uploads", DATABASE_URL="./data/test.db")
        assert settings.UPLOAD_DIR == "./uploads"
        assert settings.DATABASE_URL == "./data/test.db"
        assert settings.CHROMA_PERSIST_DIR == "./data/chroma"

    def test_api_key_detection(self):
        settings = Settings(_env_file=None, OPENAI_API_KEY="sk-test-123", UPLOAD_DIR="./uploads", DATABASE_URL="./data/test.db")
        assert settings.has_api_key("openai") is True
        assert settings.has_api_key("anthropic") is False

    def test_all_provider_keys(self):
        settings = Settings(_env_file=None, OPENAI_API_KEY="sk-test", ANTHROPIC_API_KEY="sk-ant-test", COHERE_API_KEY="co-test", UPLOAD_DIR="./uploads", DATABASE_URL="./data/test.db")
        available = settings.available_providers()
        assert "openai" in available
        assert "anthropic" in available
        assert "cohere" in available
        assert "ollama" in available
