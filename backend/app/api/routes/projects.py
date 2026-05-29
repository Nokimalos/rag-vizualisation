import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import Database
from app.providers.manager import ProviderManager

_db: Database | None = None
_provider_manager: ProviderManager | None = None


def init_dependencies(db: Database, pm: ProviderManager) -> None:
    global _db, _provider_manager
    _db = db
    _provider_manager = pm


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


def get_provider_manager() -> ProviderManager:
    if _provider_manager is None:
        raise RuntimeError("ProviderManager not initialized")
    return _provider_manager


router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


@router.get("")
async def list_projects():
    db = get_db()
    projects = await db.list_projects()
    # Add document count per project
    for project in projects:
        docs = await db.list_documents(project_id=project["id"])
        project["document_count"] = len(docs)
        project["total_chunks"] = sum(d["num_chunks"] for d in docs)
    return projects


@router.post("")
async def create_project(request: CreateProjectRequest):
    db = get_db()
    project_id = str(uuid.uuid4())
    await db.create_project(project_id, request.name, request.description)

    # Create the vector collection
    pm = get_provider_manager()
    vectordb = pm.get_vectordb()
    collection = f"proj_{project_id[:8]}"
    await vectordb.create_collection(collection)

    project = await db.get_project(project_id)
    return project


@router.get("/{project_id}")
async def get_project(project_id: str):
    db = get_db()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    docs = await db.list_documents(project_id=project_id)
    return {
        **project,
        "documents": docs,
        "document_count": len(docs),
        "total_chunks": sum(d["num_chunks"] for d in docs),
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    db = get_db()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete vector collection
    pm = get_provider_manager()
    vectordb = pm.get_vectordb()
    try:
        await vectordb.delete_collection(project["collection"])
    except Exception:
        pass

    # Delete project + its documents from DB
    await db.delete_project(project_id)
    return {"status": "deleted", "id": project_id}
