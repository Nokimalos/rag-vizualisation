import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.events import EventEmitter
from app.core.pipeline import PipelineEngine
from app.models.schemas import PipelineEvent

# ---------------------------------------------------------------------------
# Module-level dependency singletons
# ---------------------------------------------------------------------------

_emitter: EventEmitter | None = None
_pipeline: PipelineEngine | None = None


def init_dependencies(emitter: EventEmitter, pipeline: PipelineEngine) -> None:
    global _emitter, _pipeline
    _emitter = emitter
    _pipeline = pipeline


def get_emitter() -> EventEmitter:
    if _emitter is None:
        raise RuntimeError("EventEmitter not initialized")
    return _emitter


def get_pipeline() -> PipelineEngine:
    if _pipeline is None:
        raise RuntimeError("PipelineEngine not initialized")
    return _pipeline


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_event(self, websocket: WebSocket, event: PipelineEvent) -> None:
        """Send event in the format the frontend expects."""
        await websocket.send_json({
            "type": "pipeline_event",
            "event": event.type.value,
            "step": event.step,
            "total_steps": event.total_steps,
            "data": event.data,
            "timestamp": event.timestamp.isoformat(),
        })


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


async def _run_pipeline_query(
    websocket: WebSocket,
    query: str,
    collection: str = "default",
) -> None:
    pipeline = get_pipeline()
    try:
        # Use streaming mode — tokens are emitted as pipeline events via the emitter
        # which are forwarded to the WS client by the forward_event handler
        full_answer = ""
        async for token in pipeline.run_query_stream(query=query, collection=collection):
            full_answer += token

        # Send final result with full answer
        await websocket.send_json({
            "type": "query_complete",
            "data": {"answer": full_answer},
        })
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})


@router.websocket("/ws/pipeline")
async def pipeline_websocket(websocket: WebSocket) -> None:
    emitter = get_emitter()
    await manager.connect(websocket)

    async def forward_event(event: PipelineEvent) -> None:
        try:
            await manager.send_event(websocket, event)
        except Exception:
            pass

    emitter.subscribe(forward_event)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "start_query":
                # Frontend sends: { type: "start_query", payload: { text, mode } }
                payload = data.get("payload", {})
                query = payload.get("text", "")
                collection = payload.get("collection", "default")
                asyncio.create_task(
                    _run_pipeline_query(websocket, query, collection)
                )

    except WebSocketDisconnect:
        pass
    finally:
        emitter.unsubscribe(forward_event)
        manager.disconnect(websocket)
