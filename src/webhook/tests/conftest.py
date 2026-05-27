import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import create_app
from app.providers.tunnels.base import AbstractTunnelProvider


@pytest.fixture
def mock_redis_service():
    redis_mock = AsyncMock()
    redis_mock.publish_webhook.return_value = None
    redis_mock.client.publish = AsyncMock(return_value=1)
    return redis_mock


@pytest.fixture
def mock_tunnel_provider():
    tunnel = AsyncMock(spec=AbstractTunnelProvider)
    tunnel.public_url = "https://mock-tunnel.ngrok.io"
    return tunnel


@pytest.fixture
def app(mock_redis_service):
    with (
        patch(
            "app.main.get_redis_service", new=AsyncMock(return_value=mock_redis_service)
        ),
        patch("app.main.close_redis_connection", new=AsyncMock()),
        patch("app.main.listen_redis", new=AsyncMock()),
    ):
        yield create_app()


@pytest.fixture
def client(app, mock_redis_service):
    from app.controllers.webhook_routes import get_redis_service

    app.dependency_overrides[get_redis_service] = lambda: mock_redis_service
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
