import pytest

from app.core.events import EventEmitter
from app.models.schemas import PipelineEvent, PipelineEventType


class TestEventEmitter:
    @pytest.fixture
    def emitter(self):
        return EventEmitter()

    @pytest.mark.asyncio
    async def test_subscribe_and_emit(self, emitter):
        received = []

        async def handler(event):
            received.append(event)

        emitter.subscribe(handler)
        event = PipelineEvent(
            type=PipelineEventType.QUERY_RECEIVED, step=1, total_steps=8, data={"text": "test"}
        )
        await emitter.emit(event)
        assert len(received) == 1
        assert received[0].type == PipelineEventType.QUERY_RECEIVED

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, emitter):
        received_a, received_b = [], []

        async def handler_a(event):
            received_a.append(event)

        async def handler_b(event):
            received_b.append(event)

        emitter.subscribe(handler_a)
        emitter.subscribe(handler_b)
        event = PipelineEvent(type=PipelineEventType.QUERY_RECEIVED, step=1, total_steps=8)
        await emitter.emit(event)
        assert len(received_a) == 1
        assert len(received_b) == 1

    @pytest.mark.asyncio
    async def test_unsubscribe(self, emitter):
        received = []

        async def handler(event):
            received.append(event)

        emitter.subscribe(handler)
        emitter.unsubscribe(handler)
        await emitter.emit(
            PipelineEvent(type=PipelineEventType.QUERY_RECEIVED, step=1, total_steps=8)
        )
        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_event_history(self, emitter):
        await emitter.emit(
            PipelineEvent(type=PipelineEventType.QUERY_RECEIVED, step=1, total_steps=8)
        )
        assert len(emitter.history) == 1

    def test_clear_history(self, emitter):
        emitter.history.append("fake_event")
        emitter.clear_history()
        assert len(emitter.history) == 0
