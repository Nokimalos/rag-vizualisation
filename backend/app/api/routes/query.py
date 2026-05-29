from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.models.schemas import QueryRequest


class PromptConfig(BaseModel):
    system_prompt: str
    prompt_template: str


# ---------------------------------------------------------------------------
# Module-level dependency singletons
# ---------------------------------------------------------------------------

_pipeline: PipelineEngine | None = None
_db: Database | None = None


def init_dependencies(pipeline: PipelineEngine, db: Database) -> None:
    global _pipeline, _db
    _pipeline = pipeline
    _db = db


def get_pipeline() -> PipelineEngine:
    if _pipeline is None:
        raise RuntimeError("PipelineEngine not initialized")
    return _pipeline


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("")
async def run_query(request: QueryRequest):
    engine = get_pipeline()
    result = await engine.run_query(query=request.text, collection=request.collection)
    return {
        "run_id": result["run_id"],
        "status": "completed",
        "answer": result.get("answer"),
        "total_latency_ms": result.get("total_latency_ms"),
    }


@router.get("/{run_id}/history")
async def get_run_history(run_id: str):
    db = get_db()
    run = await db.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
    events = await db.get_run_events(run_id)
    return {"run": run, "events": events}


@router.get("/prompt/config")
async def get_prompt_config():
    engine = get_pipeline()
    return PromptConfig(
        system_prompt=engine.system_prompt,
        prompt_template=engine.prompt_template,
    )


@router.put("/prompt/config")
async def update_prompt_config(config: PromptConfig):
    engine = get_pipeline()
    engine.system_prompt = config.system_prompt
    engine.prompt_template = config.prompt_template
    return {"status": "ok"}
