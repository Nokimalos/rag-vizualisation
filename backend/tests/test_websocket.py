from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def sync_client():
    return TestClient(app)


class TestWebSocketConnects:
    def test_websocket_connects(self, sync_client):
        mock_emitter = MagicMock()
        mock_emitter.subscribe = MagicMock()
        mock_emitter.unsubscribe = MagicMock()

        mock_pipeline = MagicMock()

        with (
            patch("app.api.websocket.get_emitter", return_value=mock_emitter),
            patch("app.api.websocket.get_pipeline", return_value=mock_pipeline),
        ):
            with sync_client.websocket_connect("/ws/pipeline"):
                # just connecting and disconnecting should work
                pass

    def test_websocket_ping_pong(self, sync_client):
        mock_emitter = MagicMock()
        mock_emitter.subscribe = MagicMock()
        mock_emitter.unsubscribe = MagicMock()

        mock_pipeline = MagicMock()

        with (
            patch("app.api.websocket.get_emitter", return_value=mock_emitter),
            patch("app.api.websocket.get_pipeline", return_value=mock_pipeline),
        ):
            with sync_client.websocket_connect("/ws/pipeline") as ws:
                ws.send_json({"type": "ping"})
                data = ws.receive_json()
                assert data["type"] == "pong"

    def test_websocket_unknown_message_type(self, sync_client):
        mock_emitter = MagicMock()
        mock_emitter.subscribe = MagicMock()
        mock_emitter.unsubscribe = MagicMock()

        mock_pipeline = MagicMock()

        with (
            patch("app.api.websocket.get_emitter", return_value=mock_emitter),
            patch("app.api.websocket.get_pipeline", return_value=mock_pipeline),
        ):
            with sync_client.websocket_connect("/ws/pipeline") as ws:
                ws.send_json({"type": "unknown_message"})
                # Should not crash; just ignore or handle gracefully
                ws.send_json({"type": "ping"})
                data = ws.receive_json()
                assert data["type"] == "pong"
