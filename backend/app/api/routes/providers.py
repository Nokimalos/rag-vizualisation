from fastapi import APIRouter

from app.models.schemas import ProviderConfig, ProviderType
from app.providers.manager import ProviderManager

# ---------------------------------------------------------------------------
# Module-level dependency singletons
# ---------------------------------------------------------------------------

_provider_manager: ProviderManager | None = None


def init_dependencies(provider_manager: ProviderManager) -> None:
    global _provider_manager
    _provider_manager = provider_manager


def get_provider_manager() -> ProviderManager:
    if _provider_manager is None:
        raise RuntimeError("ProviderManager not initialized")
    return _provider_manager


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("")
async def list_providers():
    pm = get_provider_manager()
    return pm.list_providers()


@router.put("/config")
async def update_provider_config(config: ProviderConfig):
    pm = get_provider_manager()
    if config.provider_type == ProviderType.LLM:
        pm.set_active_llm(config.provider_name)
    elif config.provider_type == ProviderType.EMBEDDING:
        pm.set_active_embedding(config.provider_name)
    elif config.provider_type == ProviderType.VECTORDB:
        pm.set_active_vectordb(config.provider_name)
    return {"status": "ok", "provider_type": config.provider_type, "provider_name": config.provider_name}
