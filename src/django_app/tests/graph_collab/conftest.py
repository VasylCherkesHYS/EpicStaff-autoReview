import pytest
import fakeredis.aioredis


from django.contrib.auth import get_user_model
from django.test import override_settings

from tables.models import Graph
from tables.graph_collab.presence_service import presence_service
from tables.graph_collab import graph_state_service as _gss_module


CHANNEL_LAYERS_OVERRIDE = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


@pytest.fixture
def channel_layer_settings(autouse=True):
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
