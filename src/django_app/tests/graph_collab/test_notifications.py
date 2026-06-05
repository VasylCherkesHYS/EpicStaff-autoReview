"""
Unit tests for GraphEditNotifier — message construction and defensive branches.

These tests do NOT hit the DB for the core message-shape tests (SimpleNamespace
is sufficient). The DB-using variant is also included to show a real user works.
"""

import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from tables.graph_collab.notifications import GraphEditNotifier


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fake_layer(mocker):
    layer = mocker.MagicMock()
    layer.group_send = AsyncMock()
    return layer


# ---------------------------------------------------------------------------
# Message content
# ---------------------------------------------------------------------------


def test_notify_graph_saved_sends_correct_message(mocker):
    layer = _fake_layer(mocker)
    mocker.patch(
        "tables.graph_collab.notifications.get_channel_layer",
        return_value=layer,
    )

    user = SimpleNamespace(pk=42, display_name="Alice", email="alice@example.com")

    GraphEditNotifier.notify_graph_saved(
        graph_id=7,
        new_save_version=5,
        user=user,
        saved_at="2026-01-01T00:00:00",
    )

    layer.group_send.assert_called_once()
    group_name, message = layer.group_send.call_args.args

    assert group_name == "graph_edit_7"
    assert message["type"] == "graph_saved"
    assert message["graph_id"] == 7
    assert message["new_save_version"] == 5
    assert message["saved_by"]["user_id"] == 42
    assert message["saved_at"] == "2026-01-01T00:00:00"


@pytest.mark.django_db
def test_notify_graph_saved_with_real_user_sends_correct_message(mocker):
    from django.contrib.auth import get_user_model

    layer = _fake_layer(mocker)
    mocker.patch(
        "tables.graph_collab.notifications.get_channel_layer",
        return_value=layer,
    )

    User = get_user_model()
    user = User.objects.create_user(
        email="notif@example.com",
        password="Pass123!",
        display_name="Notif User",
    )

    GraphEditNotifier.notify_graph_saved(
        graph_id=99,
        new_save_version=3,
        user=user,
        saved_at="2026-06-01T12:00:00",
    )

    layer.group_send.assert_called_once()
    _, message = layer.group_send.call_args.args
    assert message["type"] == "graph_saved"
    assert message["graph_id"] == 99
    assert message["saved_by"]["user_id"] == user.pk


# ---------------------------------------------------------------------------
# Defensive branches
# ---------------------------------------------------------------------------


def test_send_with_no_channel_layer_does_not_raise(mocker):
    mocker.patch(
        "tables.graph_collab.notifications.get_channel_layer",
        return_value=None,
    )
    user = SimpleNamespace(pk=1, display_name="x", email="x@y.z")

    # Must not raise even though the channel layer is absent.
    GraphEditNotifier.notify_graph_saved(
        graph_id=1,
        new_save_version=1,
        user=user,
        saved_at="2026-01-01T00:00:00",
    )


def test_send_swallows_group_send_error(mocker):
    layer = mocker.MagicMock()
    layer.group_send = AsyncMock(side_effect=Exception("boom"))
    mocker.patch(
        "tables.graph_collab.notifications.get_channel_layer",
        return_value=layer,
    )

    user = SimpleNamespace(pk=2, display_name="y", email="y@z.com")

    # Must not raise — the try/except in _send swallows transport errors.
    GraphEditNotifier.notify_graph_saved(
        graph_id=2,
        new_save_version=2,
        user=user,
        saved_at="2026-01-01T00:00:00",
    )
