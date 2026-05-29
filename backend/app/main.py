import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import websocket
from app.api.routes import documents, embeddings, projects, providers, query, stats
from app.core.config import settings
from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.db.database import Database
from app.providers.embedding.cohere_embed import CohereEmbeddingProvider
from app.providers.embedding.ollama_embed import OllamaEmbeddingProvider
from app.providers.embedding.openai_embed import OpenAIEmbeddingProvider
from app.providers.llm.anthropic_llm import AnthropicLLMProvider
from app.providers.llm.ollama_llm import OllamaLLMProvider
from app.providers.llm.openai_llm import OpenAILLMProvider
from app.providers.manager import ProviderManager
from app.providers.vectordb.chroma_db import ChromaDBProvider

logger = logging.getLogger(__name__)


def create_provider_manager() -> ProviderManager:
    pm = ProviderManager()
    # Register LLMs
    if settings.OPENAI_API_KEY:
        pm.register_llm("openai", OpenAILLMProvider(api_key=settings.OPENAI_API_KEY))
    if settings.ANTHROPIC_API_KEY:
        pm.register_llm("anthropic", AnthropicLLMProvider(api_key=settings.ANTHROPIC_API_KEY))
    pm.register_llm("ollama", OllamaLLMProvider(base_url=settings.OLLAMA_BASE_URL))
    # vLLM support via OpenAI-compatible API
    if settings.VLLM_BASE_URL:
        pm.register_llm(
            "vllm",
            OpenAILLMProvider(
                api_key="not-needed",
                model=settings.VLLM_MODEL or "default",
                base_url=settings.VLLM_BASE_URL,
            ),
        )
    # Register embeddings
    if settings.OPENAI_API_KEY:
        pm.register_embedding("openai", OpenAIEmbeddingProvider(api_key=settings.OPENAI_API_KEY))
    if settings.COHERE_API_KEY:
        pm.register_embedding("cohere", CohereEmbeddingProvider(api_key=settings.COHERE_API_KEY))
    pm.register_embedding("ollama", OllamaEmbeddingProvider(base_url=settings.OLLAMA_BASE_URL))
    # Register vectorDB (ChromaDB always available)
    pm.register_vectordb("chromadb", ChromaDBProvider(path=settings.CHROMA_PERSIST_DIR))
    # Optional vector DBs — registered only when configured, never the default.
    # Failures (server down, missing driver) are logged and skipped so the app still boots.
    if settings.QDRANT_URL:
        try:
            from app.providers.vectordb.qdrant_db import QdrantDBProvider

            pm.register_vectordb(
                "qdrant",
                QdrantDBProvider(url=settings.QDRANT_URL, vector_size=settings.VECTOR_DIM),
            )
        except Exception as exc:
            logger.warning("Qdrant provider not registered: %s", exc)
    if settings.PGVECTOR_CONNECTION_STRING:
        try:
            from app.providers.vectordb.pgvector_db import PgVectorDBProvider

            pm.register_vectordb(
                "pgvector",
                PgVectorDBProvider(
                    connection_string=settings.PGVECTOR_CONNECTION_STRING,
                    vector_size=settings.VECTOR_DIM,
                ),
            )
        except Exception as exc:
            logger.warning("pgvector provider not registered: %s", exc)
    # Set defaults — prefer OpenAI > Anthropic > Ollama for LLM
    if settings.OPENAI_API_KEY:
        default_llm = "openai"
    elif settings.ANTHROPIC_API_KEY:
        default_llm = "anthropic"
    else:
        default_llm = "ollama"
    try:
        pm.set_active_llm(default_llm)
    except ValueError:
        pm.set_active_llm("ollama")

    # Embeddings — Anthropic doesn't provide embeddings, fallback to OpenAI > Ollama
    if settings.OPENAI_API_KEY:
        default_embed = "openai"
    elif settings.COHERE_API_KEY:
        default_embed = "cohere"
    else:
        default_embed = "ollama"
    try:
        pm.set_active_embedding(default_embed)
    except ValueError:
        pm.set_active_embedding("ollama")
    pm.set_active_vectordb("chromadb")
    return pm


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    db_dir = os.path.dirname(settings.DATABASE_URL)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    db = Database(settings.DATABASE_URL)
    await db.initialize()
    emitter = EventEmitter()
    pm = create_provider_manager()
    pipeline = PipelineEngine(pm, emitter, db)
    # Inject dependencies
    documents.init_dependencies(db, pm, emitter)
    projects.init_dependencies(db, pm)
    query.init_dependencies(pipeline, db)
    providers.init_dependencies(pm)
    stats.init_dependencies(db)
    embeddings.init_dependencies(pm)
    websocket.init_dependencies(emitter, pipeline)
    yield
    await db.close()


app = FastAPI(title="RAG Pipeline Visualization", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(query.router)
app.include_router(providers.router)
app.include_router(stats.router)
app.include_router(embeddings.router)
app.include_router(websocket.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
