"""
Integration tests: verify that a graph_saved broadcast is emitted on every
mutation path that calls GraphEditNotifier.notify_graph_saved.

Mocking strategy: only the Redis transport layer is replaced with a MagicMock
so the full real chain (view → notifier → message construction → group routing)
executes. Suppressing just get_channel_layer prevents the test from being a
no-op while still running all the real serializer / service code.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from unittest.mock import AsyncMock

from tables.graph_versioning.services import GraphVersioningService
from tables.models import Graph
from tests.fixtures import *  # noqa: F401,F403


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _assert_graph_saved(
    fake_layer, graph_id: int, user_id: int, expected_version: int
) -> None:
    fake_layer.group_send.assert_called_once()
    group_name, message = fake_layer.group_send.call_args.args
    assert group_name == f"graph_edit_{graph_id}"
    assert message["type"] == "graph_saved"
    assert message["graph_id"] == graph_id
    assert message["saved_by"]["user_id"] == user_id
    assert message["new_save_version"] == expected_version


def _patch_channel_layer(mocker):
    """Return a fake channel layer whose group_send is an AsyncMock."""
    fake_layer = mocker.MagicMock()
    fake_layer.group_send = AsyncMock()
    mocker.patch(
        "tables.graph_collab.notifications.get_channel_layer",
        return_value=fake_layer,
    )
    return fake_layer


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_put_broadcasts_graph_saved(auth_client, regular_user, graph, mocker):
    fake_layer = _patch_channel_layer(mocker)

    url = reverse("graphs-detail", args=[graph.id])

    # Build a minimal valid PUT body — save_version is required for updates.
    payload = {
        "name": "renamed graph",
        "save_version": graph.save_version,
    }
    response = auth_client.put(url, payload, format="json")
    assert response.status_code == status.HTTP_200_OK, response.content

    expected_version = Graph.objects.get(pk=graph.id).save_version
    _assert_graph_saved(fake_layer, graph.id, regular_user.pk, expected_version)


@pytest.mark.django_db
def test_patch_broadcasts_graph_saved(auth_client, regular_user, graph, mocker):
    fake_layer = _patch_channel_layer(mocker)

    url = reverse("graphs-detail", args=[graph.id])
    payload = {
        "name": "renamed via patch",
        "save_version": graph.save_version,
    }
    response = auth_client.patch(url, payload, format="json")
    assert response.status_code == status.HTTP_200_OK, response.content

    expected_version = Graph.objects.get(pk=graph.id).save_version
    _assert_graph_saved(fake_layer, graph.id, regular_user.pk, expected_version)


@pytest.mark.django_db
def test_save_flow_broadcasts_graph_saved(auth_client, regular_user, graph, mocker):
    fake_layer = _patch_channel_layer(mocker)

    url = reverse("graphs-save-flow", args=[graph.id])
    payload = {
        "save_version": graph.save_version,
        "python_node_list": [
            {
                "graph": graph.id,
                "python_code": {
                    "code": "def main(): return 1",
                    "entrypoint": "main",
                    "libraries": [],
                },
            }
        ],
    }
    response = auth_client.post(url, payload, format="json")
    assert response.status_code == status.HTTP_200_OK, response.content

    expected_version = Graph.objects.get(pk=graph.id).save_version
    _assert_graph_saved(fake_layer, graph.id, regular_user.pk, expected_version)


@pytest.mark.django_db
def test_restore_broadcasts_graph_saved(auth_client, regular_user, graph, mocker):
    # Create a named version to restore from.
    version = GraphVersioningService().save_version(graph, name="v1")

    fake_layer = _patch_channel_layer(mocker)

    url = reverse("graph-versions-restore", args=[version.id])
    payload = {"save_version": graph.save_version}
    response = auth_client.post(url, payload, format="json")
    assert response.status_code == status.HTTP_200_OK, response.content

    result_graph_id = response.data["graph_id"]
    assert result_graph_id == graph.id

    expected_version = Graph.objects.get(pk=graph.id).save_version
    _assert_graph_saved(fake_layer, graph.id, regular_user.pk, expected_version)


@pytest.mark.django_db
def test_save_flow_version_conflict_does_not_broadcast(auth_client, graph, mocker):
    fake_layer = _patch_channel_layer(mocker)

    url = reverse("graphs-save-flow", args=[graph.id])
    payload = {
        "save_version": graph.save_version + 999,
    }
    response = auth_client.post(url, payload, format="json")
    assert response.status_code == status.HTTP_409_CONFLICT, response.content

    fake_layer.group_send.assert_not_called()
