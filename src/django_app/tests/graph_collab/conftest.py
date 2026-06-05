import pytest

from django.contrib.auth import get_user_model
from django.test import override_settings

from tables.models import Graph
from tables.graph_collab.presence_service import presence_service


CHANNEL_LAYERS_OVERRIDE = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


@pytest.fixture
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


@pytest.fixture(autouse=True)
def reset_presence_store():
    """Reset the module-level presence store between tests to prevent state leakage."""
    presence_service._store.clear()
    yield
    presence_service._store.clear()
