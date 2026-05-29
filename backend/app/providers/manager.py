from typing import Any

from app.providers.embedding.base import EmbeddingProvider
from app.providers.llm.base import LLMProvider
from app.providers.vectordb.base import VectorDBProvider


class ProviderManager:
    def __init__(self) -> None:
        self._llm_providers: dict[str, LLMProvider] = {}
        self._embedding_providers: dict[str, EmbeddingProvider] = {}
        self._vectordb_providers: dict[str, VectorDBProvider] = {}
        self._active_llm: str | None = None
        self._active_embedding: str | None = None
        self._active_vectordb: str | None = None

    # ------------------------------------------------------------------ #
    # Registration
    # ------------------------------------------------------------------ #

    def register_llm(self, name: str, provider: LLMProvider) -> None:
        self._llm_providers[name] = provider

    def register_embedding(self, name: str, provider: EmbeddingProvider) -> None:
        self._embedding_providers[name] = provider

    def register_vectordb(self, name: str, provider: VectorDBProvider) -> None:
        self._vectordb_providers[name] = provider

    # ------------------------------------------------------------------ #
    # Set active
    # ------------------------------------------------------------------ #

    def set_active_llm(self, name: str) -> None:
        if name not in self._llm_providers:
            raise ValueError(f"Unknown LLM provider: {name!r}")
        self._active_llm = name

    def set_active_embedding(self, name: str) -> None:
        if name not in self._embedding_providers:
            raise ValueError(f"Unknown embedding provider: {name!r}")
        self._active_embedding = name

    def set_active_vectordb(self, name: str) -> None:
        if name not in self._vectordb_providers:
            raise ValueError(f"Unknown vectordb provider: {name!r}")
        self._active_vectordb = name

    # ------------------------------------------------------------------ #
    # Get active
    # ------------------------------------------------------------------ #

    def get_llm(self) -> LLMProvider:
        if self._active_llm is None:
            raise ValueError("No active LLM provider set")
        return self._llm_providers[self._active_llm]

    def get_embedding(self) -> EmbeddingProvider:
        if self._active_embedding is None:
            raise ValueError("No active embedding provider set")
        return self._embedding_providers[self._active_embedding]

    def get_vectordb(self) -> VectorDBProvider:
        if self._active_vectordb is None:
            raise ValueError("No active vectordb provider set")
        return self._vectordb_providers[self._active_vectordb]

    # ------------------------------------------------------------------ #
    # Introspection
    # ------------------------------------------------------------------ #

    def list_providers(self) -> dict[str, Any]:
        return {
            "llm": {
                "available": list(self._llm_providers.keys()),
                "active": self._active_llm,
            },
            "embedding": {
                "available": list(self._embedding_providers.keys()),
                "active": self._active_embedding,
            },
            "vectordb": {
                "available": list(self._vectordb_providers.keys()),
                "active": self._active_vectordb,
            },
        }
