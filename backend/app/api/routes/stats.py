from fastapi import APIRouter

from app.db.database import Database

# ---------------------------------------------------------------------------
# Module-level dependency singletons
# ---------------------------------------------------------------------------

_db: Database | None = None


def init_dependencies(db: Database) -> None:
    global _db
    _db = db


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
async def get_stats():
    db = get_db()
    return await db.get_stats()


@router.get("/runs")
async def list_runs(limit: int = 20):
    db = get_db()
    return await db.list_runs(limit=limit)
