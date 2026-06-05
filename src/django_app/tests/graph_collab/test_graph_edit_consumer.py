import pytest
from django.urls import re_path
from channels.testing import WebsocketCommunicator
from django.test import override_settings
from channels.routing import URLRouter

from tables.graph_collab.consumers import GraphEditConsumer

from tests.graph_collab.conftest import CHANNEL_LAYERS_OVERRIDE


application = URLRouter(
    [re_path(r"ws/graphs/(?P<graph_id>\d+)/edit/$", GraphEditConsumer.as_asgi())]
)


def _make_communicator(graph_id: int, user=None):
    """Build a communicator with scope["user"] pre-set (bypasses ticket middleware)."""
    from django.contrib.auth.models import AnonymousUser

    scope_user = user or AnonymousUser()
    communicator = WebsocketCommunicator(
        application,
        f"ws/graphs/{graph_id}/edit/",
    )
    communicator.scope["user"] = scope_user
    return communicator


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_connect_authenticated_receives_no_error(test_graph, test_user):
    communicator = _make_communicator(test_graph.pk, test_user)
    connected, _ = await communicator.connect()
    assert connected
    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_connect_anonymous_is_rejected(test_graph):
    communicator = _make_communicator(test_graph.pk, user=None)
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4401


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_connect_nonexistent_graph_is_rejected(test_user):
    communicator = _make_communicator(999999, test_user)
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4404


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_graph_modified_broadcast_to_group(test_graph, test_user, second_user):
    comm1 = _make_communicator(test_graph.pk, test_user)
    comm2 = _make_communicator(test_graph.pk, second_user)

    connected1, _ = await comm1.connect()
    # Drain comm1's initial presence_state and the user_joined it sends to itself.
    msg = await comm1.receive_json_from()
    assert msg["type"] == "presence_state"
    msg = await comm1.receive_json_from()
    assert msg["type"] == "user_joined"

    connected2, _ = await comm2.connect()
    assert connected1 and connected2

    # comm1 receives user_joined for second_user.
    msg = await comm1.receive_json_from()
    assert msg["type"] == "user_joined"
    assert msg["editor"]["user_id"] == second_user.pk

    # comm2 receives its own presence_state (both users), then user_joined for itself.
    msg = await comm2.receive_json_from()
    assert msg["type"] == "presence_state"
    msg = await comm2.receive_json_from()
    assert msg["type"] == "user_joined"

    await comm1.send_json_to({"type": "graph_modified"})

    # Both consumers should receive the broadcast (including sender — group_send goes to all).
    msg1 = await comm1.receive_json_from()
    msg2 = await comm2.receive_json_from()

    assert msg1["type"] == "graph_modified"
    assert msg1["graph_id"] == test_graph.pk
    assert msg1["modified_by"]["user_id"] == test_user.pk

    assert msg2["type"] == "graph_modified"
    assert msg2["modified_by"]["user_id"] == test_user.pk

    await comm1.disconnect()
    await comm2.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_unknown_message_type_returns_error(test_graph, test_user):
    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    # Drain presence_state and user_joined sent on connect.
    await communicator.receive_json_from()
    await communicator.receive_json_from()

    await communicator.send_json_to({"type": "does_not_exist"})
    msg = await communicator.receive_json_from()

    assert msg["type"] == "error"
    assert msg["code"] == "unknown_message_type"

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_graph_saved_pushed_via_notifier(test_graph, test_user):
    from asgiref.sync import sync_to_async
    from django.utils import timezone

    from tables.graph_collab.notifications import GraphEditNotifier

    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    # Drain presence_state and user_joined sent on connect.
    await communicator.receive_json_from()
    await communicator.receive_json_from()

    await sync_to_async(GraphEditNotifier.notify_graph_saved)(
        graph_id=test_graph.pk,
        new_save_version=5,
        user=test_user,
        saved_at=timezone.now().isoformat(),
    )

    msg = await communicator.receive_json_from()
    assert msg["type"] == "graph_saved"
    assert msg["graph_id"] == test_graph.pk
    assert msg["new_save_version"] == 5
    assert msg["saved_by"]["user_id"] == test_user.pk

    await communicator.disconnect()


# --- Presence tests ---


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_first_user_connect_receives_presence_state_with_self(
    test_graph, test_user
):
    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    msg = await communicator.receive_json_from()
    assert msg["type"] == "presence_state"
    editors = msg["editors"]
    assert len(editors) == 1
    assert editors[0]["user_id"] == test_user.pk

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_second_user_connect_first_receives_user_joined(
    test_graph, test_user, second_user
):
    comm1 = _make_communicator(test_graph.pk, test_user)
    comm2 = _make_communicator(test_graph.pk, second_user)

    await comm1.connect()
    # Drain comm1 initial messages.
    await comm1.receive_json_from()  # presence_state
    await comm1.receive_json_from()  # user_joined (self)

    await comm2.connect()

    # comm1 should receive user_joined for second_user.
    msg = await comm1.receive_json_from()
    assert msg["type"] == "user_joined"
    assert msg["editor"]["user_id"] == second_user.pk

    # comm2's presence_state should contain both users.
    msg = await comm2.receive_json_from()
    assert msg["type"] == "presence_state"
    editor_ids = {e["user_id"] for e in msg["editors"]}
    assert test_user.pk in editor_ids
    assert second_user.pk in editor_ids

    await comm1.disconnect()
    await comm2.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_OVERRIDE)
async def test_user_disconnect_remaining_receives_user_left(
    test_graph, test_user, second_user
):
    comm1 = _make_communicator(test_graph.pk, test_user)
    comm2 = _make_communicator(test_graph.pk, second_user)

    await comm1.connect()
    await comm1.receive_json_from()  # presence_state
    await comm1.receive_json_from()  # user_joined (self)

    await comm2.connect()
    await comm1.receive_json_from()  # user_joined for second_user
    await comm2.receive_json_from()  # presence_state
    await comm2.receive_json_from()  # user_joined (self)

    await comm1.disconnect()

    # comm2 should receive user_left with test_user's id.
    msg = await comm2.receive_json_from()
    assert msg["type"] == "user_left"
    assert msg["user_id"] == test_user.pk

    await comm2.disconnect()
