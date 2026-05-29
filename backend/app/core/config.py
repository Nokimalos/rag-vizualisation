from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    VLLM_BASE_URL: str = ""
    VLLM_MODEL: str = ""
    COHERE_API_KEY: str = ""
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    QDRANT_URL: str = "http://localhost:6333"
    PGVECTOR_CONNECTION_STRING: str = ""
    UPLOAD_DIR: str = "./uploads"
    DATABASE_URL: str = "./data/rag_viz.db"
    CORS_ORIGINS: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}

    def has_api_key(self, provider: str) -> bool:
        key_map = {"openai": self.OPENAI_API_KEY, "anthropic": self.ANTHROPIC_API_KEY, "cohere": self.COHERE_API_KEY}
        return bool(key_map.get(provider, ""))

    def available_providers(self) -> list[str]:
        providers = ["ollama"]
        for name in ["openai", "anthropic", "cohere"]:
            if self.has_api_key(name):
                providers.append(name)
        return providers

settings = Settings()
