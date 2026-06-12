import pytest
import fakeredis.aioredis

from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import override_settings
from django.urls import re_path

from tables.graph_collab import graph_state_service as _gss_module
from tables.graph_collab import lock_service as _ls_module
from tables.graph_collab.consumers import GraphEditConsumer
from tables.graph_collab.presence_service import presence_service
from tables.models import Graph


application = URLRouter(
    [re_path(r"ws/graphs/(?P<graph_id>\d+)/edit/$", GraphEditConsumer.as_asgi())]
)


def _make_communicator(graph_id: int, user=None):
    """Build a communicator with scope["user"] pre-set (bypasses ticket middleware)."""
    scope_user = user or AnonymousUser()
    communicator = WebsocketCommunicator(
        application,
        f"ws/graphs/{graph_id}/edit/",
    )
    communicator.scope["user"] = scope_user
    return communicator


async def _drain_connect(communicator) -> None:
    """Consume the initial messages sent on connect:
    1. presence_state
    2. request_state OR graph_state (live snapshot seeding/serving)
    3. user_joined (self)
    """
    messages = {(await communicator.receive_json_from())["type"] for _ in range(3)}
    assert "presence_state" in messages
    assert "user_joined" in messages
    assert "request_state" in messages or "graph_state" in messages


CHANNEL_LAYERS_OVERRIDE = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


@pytest.fixture(autouse=True)
def channel_layer_settings():
    """Override channel layers so each test gets a fresh in-memory layer."""
    with override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE):
        yield


@pytest.fixture
def test_graph(db):
    return Graph.objects.create(name="test-graph-collab")


@pytest.fixture
def test_user(db):
    User = get_user_model()
    return User.objects.create_user(
        email="collab@example.com",
        password="TestPass123!",
        display_name="Collab User",
    )


@pytest.fixture
def second_user(db):
    User = get_user_model()
    return User.objects.create_user(
        email="collab2@example.com",
        password="TestPass123!",
        display_name="Second User",
    )


@pytest.fixture
def second_graph(db):
    return Graph.objects.create(name="test-graph-collab-2")


@pytest.fixture(autouse=True)
def reset_presence_store():
    """Reset the module-level presence store between tests to prevent state leakage."""
    presence_service._store.clear()
    yield
    presence_service._store.clear()


@pytest.fixture(autouse=True)
def reset_lock_store():
    """Reset the module-level lock store between tests to prevent state leakage."""
    _ls_module.lock_service._store.clear()
    yield
    _ls_module.lock_service._store.clear()


@pytest.fixture
def fake_async_redis():
    """Fresh fakeredis async client with decode_responses=True."""
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture(autouse=True)
def patch_graph_state_redis(fake_async_redis, monkeypatch):
    """Replace the Redis client used by graph_state_service with an in-memory fake.

    Patching ``_redis`` as a property on the class ensures the singleton's
    ``async_redis_client`` is never consulted, so tests run without a live Redis
    server and with full state isolation between tests.
    """
    monkeypatch.setattr(
        type(_gss_module.graph_state_service),
        "_redis",
        property(lambda self: fake_async_redis),
    )
    # Also reset per-graph asyncio locks between tests.
    _gss_module.graph_state_service._locks.clear()
    yield
    _gss_module.graph_state_service._locks.clear()


@pytest.fixture
def service():
    """GraphLiveStateService with its Redis client replaced by fake_redis."""
    return _gss_module.GraphLiveStateService()
