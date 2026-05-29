import asyncio
import os
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, HTTPException, UploadFile

from app.core.config import settings
from app.core.events import EventEmitter
from app.db.database import Database
from app.models.schemas import ChunkingConfig
from app.processing.chunker import Chunk, Chunker
from app.processing.codebase_parser import CodeChunk, parse_codebase
from app.processing.embedder import Embedder
from app.processing.parser import DocumentParser, parse_document
from app.providers.manager import ProviderManager

# ---------------------------------------------------------------------------
# Module-level dependency singletons (set by init_dependencies)
# ---------------------------------------------------------------------------

_db: Database | None = None
_provider_manager: ProviderManager | None = None
_emitter: EventEmitter | None = None


def init_dependencies(db: Database, pm: ProviderManager, emitter: EventEmitter) -> None:
    global _db, _provider_manager, _emitter
    _db = db
    _provider_manager = pm
    _emitter = emitter


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


def get_provider_manager() -> ProviderManager:
    if _provider_manager is None:
        raise RuntimeError("ProviderManager not initialized")
    return _provider_manager


def get_emitter() -> EventEmitter:
    if _emitter is None:
        raise RuntimeError("EventEmitter not initialized")
    return _emitter


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(project_id: str | None = None):
    db = get_db()
    docs = await db.list_documents(project_id=project_id)
    return docs


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    db = get_db()
    doc = await db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Resolve collection from project
    collection = "default"
    if doc.get("project_id"):
        project = await db.get_project(doc["project_id"])
        if project:
            collection = project["collection"]

    # Remove vectors from vector DB
    pm = get_provider_manager()
    vectordb = pm.get_vectordb()

    if hasattr(vectordb, "_get_collection"):
        try:
            col = await vectordb._get_collection(collection)
            all_data = await asyncio.to_thread(col.get, where={"document_id": doc_id})
            if all_data["ids"]:
                await asyncio.to_thread(col.delete, ids=all_data["ids"])
        except Exception:
            pass

    # Delete uploaded file
    upload_dir = Path(settings.UPLOAD_DIR)
    for f in upload_dir.iterdir():
        if f.name.startswith(doc_id):
            f.unlink(missing_ok=True)
            break

    # Delete from DB
    await db.delete_document(doc_id)

    return {"status": "deleted", "id": doc_id}


# --- Async codebase import jobs ---
_import_jobs: dict[str, dict] = {}


@router.post("/upload-codebase")
async def upload_codebase(
    file: UploadFile,
    collection: str = "default",
    project_id: str | None = None,
):
    """Upload a zip archive. Returns immediately with a job_id. Poll /import-status/{job_id}."""
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 200MB)")

    job_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    safe_name = PurePosixPath(filename).name

    _import_jobs[job_id] = {
        "status": "extracting",
        "progress": "Extracting zip...",
        "doc_id": doc_id,
        "filename": safe_name,
        "num_chunks": 0,
        "files_indexed": 0,
        "error": None,
    }

    # Resolve collection from project
    if project_id:
        db = get_db()
        project = await db.get_project(project_id)
        if project:
            collection = project["collection"]

    # Run import in background
    asyncio.create_task(
        _run_codebase_import(job_id, doc_id, safe_name, content, collection, project_id)
    )

    return {"job_id": job_id, "doc_id": doc_id, "status": "started"}


@router.get("/import-status/{job_id}")
async def get_import_status(job_id: str):
    job = _import_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def _run_codebase_import(
    job_id: str,
    doc_id: str,
    safe_name: str,
    content: bytes,
    collection: str,
    project_id: str | None = None,
) -> None:
    tmp_dir = None
    try:
        # Extract
        tmp_dir = tempfile.mkdtemp(prefix="rag_codebase_")
        zip_path = os.path.join(tmp_dir, "archive.zip")
        with open(zip_path, "wb") as f:
            f.write(content)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(os.path.join(tmp_dir, "src"))

        src_dir = os.path.join(tmp_dir, "src")
        entries = os.listdir(src_dir)
        if len(entries) == 1 and os.path.isdir(os.path.join(src_dir, entries[0])):
            src_dir = os.path.join(src_dir, entries[0])

        # Parse
        _import_jobs[job_id]["status"] = "parsing"
        _import_jobs[job_id]["progress"] = "Scanning source files..."
        code_chunks: list[CodeChunk] = await asyncio.to_thread(parse_codebase, src_dir)

        if not code_chunks:
            _import_jobs[job_id]["status"] = "error"
            _import_jobs[job_id]["error"] = "No indexable source files found"
            return

        files_indexed = len(set(cc.file_path for cc in code_chunks))
        _import_jobs[job_id]["files_indexed"] = files_indexed
        _import_jobs[job_id]["num_chunks"] = len(code_chunks)
        _import_jobs[job_id]["progress"] = f"Found {files_indexed} files, {len(code_chunks)} chunks"

        # Embed
        _import_jobs[job_id]["status"] = "embedding"
        chunks = [
            Chunk(text=cc.text, index=i, start_char=0, end_char=len(cc.text))
            for i, cc in enumerate(code_chunks)
        ]
        metas = [
            {
                "document_id": doc_id,
                "file_path": cc.file_path,
                "language": cc.language,
                "start_line": cc.start_line,
                "end_line": cc.end_line,
                "chunk_type": cc.chunk_type,
            }
            for cc in code_chunks
        ]

        pm = get_provider_manager()

        # Embed in batches with progress updates
        from app.processing.embedder import EMBED_BATCH_SIZE

        total = len(chunks)
        for batch_start in range(0, total, EMBED_BATCH_SIZE):
            batch_end = min(batch_start + EMBED_BATCH_SIZE, total)
            _import_jobs[job_id]["progress"] = f"Embedding {batch_end}/{total} chunks..."

            batch_chunks = chunks[batch_start:batch_end]
            batch_metas = metas[batch_start:batch_end]

            # Embed this batch directly
            texts = [c.text for c in batch_chunks]
            embed_result = await pm.get_embedding().embed(texts)
            embeddings = embed_result["embeddings"]
            ids = [f"{doc_id}_chunk_{c.index}" for c in batch_chunks]

            await pm.get_vectordb().create_collection(collection)
            await pm.get_vectordb().add_documents(collection, ids, texts, embeddings, batch_metas)

        # Save to DB
        _import_jobs[job_id]["status"] = "saving"
        db = get_db()
        await db.save_document(
            doc_id=doc_id,
            filename=f"[codebase] {safe_name}",
            file_type="zip",
            size_bytes=len(content),
            num_chunks=total,
            project_id=project_id,
        )

        _import_jobs[job_id]["status"] = "done"
        _import_jobs[job_id]["progress"] = f"Done: {files_indexed} files, {total} chunks indexed"

    except Exception as e:
        _import_jobs[job_id]["status"] = "error"
        _import_jobs[job_id]["error"] = str(e)
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/upload")
async def upload_document(
    file: UploadFile,
    collection: str = "default",
    project_id: str | None = None,
):
    # Resolve collection from project if provided
    if project_id:
        db = get_db()
        project = await db.get_project(project_id)
        if project:
            collection = project["collection"]

    # 1. Validate file extension
    filename = file.filename or ""
    # C4: strip directory components to prevent path traversal
    safe_name = PurePosixPath(filename).name
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    ext = Path(safe_name).suffix.lstrip(".").lower()
    supported = DocumentParser.supported_types()
    if ext not in supported:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext!r}. Supported: {supported}",
        )

    # 2. Save file to upload_dir/{uuid}_{safe_name}
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    doc_id = str(uuid.uuid4())
    saved_filename = f"{doc_id}_{safe_name}"
    file_path = upload_dir / saved_filename

    # C4: verify resolved path is within upload_dir
    if not file_path.resolve().is_relative_to(upload_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid filename")

    content = await file.read()
    # M6: enforce file size limit (50 MB)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    file_path.write_bytes(content)
    size_bytes = len(content)

    try:
        pm = get_provider_manager()
        emitter = get_emitter()
        embed_provider = pm.get_embedding()

        # 3. Parse — uses LLM vision for images when available, else Tesseract
        llm_for_vision = None
        try:
            llm_for_vision = pm.get_llm()
        except ValueError:
            pass
        parse_result = await parse_document(str(file_path), llm=llm_for_vision)

        # 4. Chunk — use semantic chunking when possible

        sentences = Chunker.get_sentences(parse_result.text)

        if len(sentences) >= 3:
            # Hybrid chunking: structure-aware + semantic similarity
            sentence_embeddings = (await embed_provider.embed(sentences))["embeddings"]
            chunks = Chunker.chunk_hybrid(
                text=parse_result.text,
                embeddings=sentence_embeddings,
                sentences=sentences,
                chunk_size=1500,
                similarity_threshold=0.5,
            )
        else:
            # Fallback to recursive for very short documents
            chunking_config = ChunkingConfig()
            chunks = Chunker.chunk(
                text=parse_result.text,
                strategy=chunking_config.strategy,
                chunk_size=chunking_config.chunk_size,
                overlap=chunking_config.overlap,
            )

        # 5. Embed chunks and store
        vdb_provider = pm.get_vectordb()
        embedder = Embedder(embed_provider, vdb_provider, emitter)
        await embedder.embed_and_store(
            chunks=chunks,
            document_id=doc_id,
            collection=collection,
            filename=safe_name,
        )

        num_chunks = len(chunks)

        # 6. Save to db
        db = get_db()
        await db.save_document(
            doc_id=doc_id,
            filename=safe_name,
            file_type=ext,
            size_bytes=size_bytes,
            num_chunks=num_chunks,
            project_id=project_id,
        )

        # 7. Return info
        return {
            "id": doc_id,
            "filename": safe_name,
            "file_type": ext,
            "size_bytes": size_bytes,
            "num_chunks": num_chunks,
        }

    except Exception:
        # Clean up saved file on error
        if file_path.exists():
            file_path.unlink()
        raise
