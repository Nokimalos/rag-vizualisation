from fastapi import APIRouter, Query

import numpy as np
import umap

from app.providers.manager import ProviderManager

# ---------------------------------------------------------------------------
# Module-level dependency singletons (set by init_dependencies)
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

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])


@router.get("/3d")
async def get_embeddings_3d(collection: str = Query(default="default")):
    import asyncio

    pm = get_provider_manager()
    vectordb = pm.get_vectordb()

    # Load collection (works even after restart thanks to _get_collection)
    try:
        if hasattr(vectordb, "_get_collection"):
            col = await vectordb._get_collection(collection)
        else:
            return {"points": [], "total": 0}
    except Exception:
        return {"points": [], "total": 0}

    # Fetch all data from the collection
    result = await asyncio.to_thread(col.get, include=["embeddings", "documents", "metadatas"])

    ids = result.get("ids") if result.get("ids") is not None else []
    raw_embeddings = result.get("embeddings") if result.get("embeddings") is not None else []
    documents = result.get("documents") if result.get("documents") is not None else []
    metadatas = result.get("metadatas") if result.get("metadatas") is not None else []

    n = len(ids)
    if n == 0:
        return {"points": [], "total": 0}

    # Dimensionality reduction to 3D
    embeddings_array = np.array(raw_embeddings, dtype=np.float32)
    if n < 15:
        # Too few points for UMAP — use PCA instead
        from sklearn.decomposition import PCA
        n_components = min(3, n, embeddings_array.shape[1])
        pca = PCA(n_components=n_components)
        reduced = pca.fit_transform(embeddings_array)
        # Pad to 3 columns if fewer
        if reduced.shape[1] < 3:
            coords_3d = np.zeros((n, 3), dtype=np.float32)
            coords_3d[:, :reduced.shape[1]] = reduced
        else:
            coords_3d = reduced
    else:
        n_neighbors = min(15, n - 1)
        reducer = umap.UMAP(n_components=3, n_neighbors=n_neighbors, random_state=42)
        coords_3d = reducer.fit_transform(embeddings_array)

    points = []
    for i, doc_id in enumerate(ids):
        text = documents[i] if i < len(documents) else ""
        metadata = metadatas[i] if i < len(metadatas) else {}
        x, y, z = float(coords_3d[i][0]), float(coords_3d[i][1]), float(coords_3d[i][2])
        points.append({
            "id": doc_id,
            "x": x,
            "y": y,
            "z": z,
            "text": text,
            "metadata": metadata,
        })

    return {"points": points, "total": n}
