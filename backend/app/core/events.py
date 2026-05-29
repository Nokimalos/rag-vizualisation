from collections import deque
from collections.abc import Awaitable, Callable

from app.models.schemas import PipelineEvent

EventHandler = Callable[[PipelineEvent], Awaitable[None]]


class EventEmitter:
    def __init__(self, max_history: int = 1000):
        self._handlers: list[EventHandler] = []
        self.history: deque[PipelineEvent] = deque(maxlen=max_history)

    def subscribe(self, handler: EventHandler) -> None:
        self._handlers.append(handler)

    def unsubscribe(self, handler: EventHandler) -> None:
        self._handlers = [h for h in self._handlers if h is not handler]

    async def emit(self, event: PipelineEvent) -> None:
        self.history.append(event)
        for handler in self._handlers:
            await handler(event)

    def clear_history(self) -> None:
        self.history.clear()
