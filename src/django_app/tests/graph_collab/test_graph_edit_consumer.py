import pytest
from django.urls import re_path
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter

from tables.graph_collab.consumers import GraphEditConsumer
from tables.graph_collab.graph_state_service import graph_state_service


async def _wait_for(
    condition_coro, timeout: float = 1.0, interval: float = 0.05
) -> bool:
    """Poll condition_coro() until it returns truthy or timeout is reached."""
    import asyncio as _asyncio

    elapsed = 0.0
    while elapsed < timeout:
        if await condition_coro():
            return True
        await _asyncio.sleep(interval)
        elapsed += interval
    return False


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
async def test_connect_authenticated_receives_no_error(test_graph, test_user):
    communicator = _make_communicator(test_graph.pk, test_user)
    connected, _ = await communicator.connect()
    assert connected
    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_anonymous_is_rejected(test_graph):
    communicator = _make_communicator(test_graph.pk, user=None)
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4401


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connect_nonexistent_graph_is_rejected(test_user):
    communicator = _make_communicator(999999, test_user)
    connected, code = await communicator.connect()
    assert not connected
    assert code == 4404


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unknown_message_type_returns_error(test_graph, test_user):
    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    # Drain presence_state, user_joined, and request_state/graph_state.
    await communicator.receive_json_from()
    await communicator.receive_json_from()
    await communicator.receive_json_from()

    await communicator.send_json_to({"type": "does_not_exist"})
    msg = await communicator.receive_json_from()

    assert msg["type"] == "error"
    assert msg["code"] == "unknown_message_type"

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_graph_saved_pushed_via_notifier(test_graph, test_user):
    from asgiref.sync import sync_to_async
    from django.utils import timezone

    from tables.graph_collab.notifications import GraphEditNotifier

    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    # Drain presence_state, user_joined, and request_state/graph_state.
    await communicator.receive_json_from()
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
async def test_second_user_connect_first_receives_user_joined(
    test_graph, test_user, second_user
):
    comm1 = _make_communicator(test_graph.pk, test_user)
    comm2 = _make_communicator(test_graph.pk, second_user)

    await comm1.connect()
    # Drain comm1 initial messages.
    await comm1.receive_json_from()  # presence_state
    await comm1.receive_json_from()  # request_state (first connector, no snapshot yet)
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
async def test_user_disconnect_remaining_receives_user_left(
    test_graph, test_user, second_user
):
    comm1 = _make_communicator(test_graph.pk, test_user)
    comm2 = _make_communicator(test_graph.pk, second_user)

    await comm1.connect()
    await comm1.receive_json_from()  # presence_state
    await comm1.receive_json_from()  # request_state
    await comm1.receive_json_from()  # user_joined (self)

    await comm2.connect()
    await comm1.receive_json_from()  # user_joined for second_user
    await comm2.receive_json_from()  # presence_state
    await (
        comm2.receive_json_from()
    )  # request_state (no snapshot yet since comm1 hasn't seeded)
    await comm2.receive_json_from()  # user_joined (self)

    await comm1.disconnect()

    # comm2 should receive user_left with test_user's id.
    msg = await comm2.receive_json_from()
    assert msg["type"] == "user_left"
    assert msg["user_id"] == test_user.pk

    await comm2.disconnect()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Relay tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_server_overrides_spoofed_editor_identity(
    test_graph, test_user, second_user
):
    comm_a = _make_communicator(test_graph.pk, test_user)
    comm_b = _make_communicator(test_graph.pk, second_user)

    await comm_a.connect()
    await _drain_connect(comm_a)

    await comm_b.connect()
    await comm_a.receive_json_from()  # user_joined for second_user
    await _drain_connect(comm_b)

    spoofed_editor = {"user_id": 9999, "display_name": "spoof", "avatar_url": None}
    await comm_a.send_json_to(
        {
            "type": "node_created",
            "node": {"id": "n1", "type": "python"},
            "editor": spoofed_editor,
        }
    )

    msg = await comm_b.receive_json_from()
    assert msg["type"] == "node_created"
    assert (
        msg["editor"]["user_id"] == test_user.pk
    ), "server must override editor identity"
    assert msg["node"] == {"id": "n1", "type": "python"}
    assert "sender_channel" not in msg

    assert await comm_a.receive_nothing(
        timeout=0.3
    ), "sender must not receive its own relay"

    await comm_a.disconnect()
    await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_node_updated_relayed_to_peer(test_graph, test_user, second_user):
    comm_a = _make_communicator(test_graph.pk, test_user)
    comm_b = _make_communicator(test_graph.pk, second_user)

    await comm_a.connect()
    await _drain_connect(comm_a)

    await comm_b.connect()
    await comm_a.receive_json_from()  # user_joined for second_user
    await _drain_connect(comm_b)

    node_payload = {"id": "n2", "type": "agent", "label": "My Agent"}
    await comm_a.send_json_to(
        {
            "type": "node_updated",
            "node": node_payload,
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    msg = await comm_b.receive_json_from()
    assert msg["type"] == "node_updated"
    assert msg["node"] == node_payload

    await comm_a.disconnect()
    await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_nodes_deleted_relayed_to_peer(test_graph, test_user, second_user):
    comm_a = _make_communicator(test_graph.pk, test_user)
    comm_b = _make_communicator(test_graph.pk, second_user)

    await comm_a.connect()
    await _drain_connect(comm_a)

    await comm_b.connect()
    await comm_a.receive_json_from()  # user_joined for second_user
    await _drain_connect(comm_b)

    await comm_a.send_json_to(
        {
            "type": "nodes_deleted",
            "node_ids": ["n1", "n2"],
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    msg = await comm_b.receive_json_from()
    assert msg["type"] == "nodes_deleted"
    assert msg["node_ids"] == ["n1", "n2"]

    await comm_a.disconnect()
    await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_connection_created_relayed_to_peer(test_graph, test_user, second_user):
    comm_a = _make_communicator(test_graph.pk, test_user)
    comm_b = _make_communicator(test_graph.pk, second_user)

    await comm_a.connect()
    await _drain_connect(comm_a)

    await comm_b.connect()
    await comm_a.receive_json_from()  # user_joined for second_user
    await _drain_connect(comm_b)

    connection_payload = {"id": "c1", "source": "n1", "target": "n2"}
    await comm_a.send_json_to(
        {
            "type": "connection_created",
            "connection": connection_payload,
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    msg = await comm_b.receive_json_from()
    assert msg["type"] == "connection_created"
    assert msg["connection"] == connection_payload

    await comm_a.disconnect()
    await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_group_isolation_across_graphs(
    test_graph, second_graph, test_user, second_user
):
    comm_a = _make_communicator(test_graph.pk, test_user)
    comm_b = _make_communicator(second_graph.pk, second_user)

    await comm_a.connect()
    await _drain_connect(comm_a)

    await comm_b.connect()
    await _drain_connect(comm_b)

    await comm_a.send_json_to(
        {
            "type": "node_created",
            "node": {"id": "n1", "type": "python"},
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    assert await comm_b.receive_nothing(
        timeout=0.3
    ), "message sent to graph A must not reach a consumer on graph B"

    await comm_a.disconnect()
    await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_malformed_payload_returns_invalid_payload_error(test_graph, test_user):
    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()
    await _drain_connect(communicator)

    # Send node_created without the required `node` field.
    await communicator.send_json_to(
        {
            "type": "node_created",
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    msg = await communicator.receive_json_from()
    assert msg["type"] == "error"
    assert msg["code"] == "invalid_payload"

    # Connection must survive a validation error — send an unknown type next.
    await communicator.send_json_to({"type": "totally_unknown"})
    msg = await communicator.receive_json_from()
    assert msg["type"] == "error"
    assert msg["code"] == "unknown_message_type"

    await communicator.disconnect()


# ---------------------------------------------------------------------------
# Block 2: live state seeding + serving
# ---------------------------------------------------------------------------


_SAMPLE_FLOW = {
    "nodes": [{"id": "n1", "type": "agent"}],
    "connections": [{"id": "c1", "source": "n1", "target": "n1"}],
}


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_first_connector_receives_request_state(test_graph, test_user):
    """First connector (no snapshot yet) must receive request_state."""
    communicator = _make_communicator(test_graph.pk, test_user)
    await communicator.connect()

    await communicator.receive_json_from()  # presence_state

    msg = await communicator.receive_json_from()
    assert msg["type"] == "request_state"

    await communicator.receive_json_from()  # user_joined
    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_second_connector_receives_graph_state_after_seed(
    test_graph, test_user, second_user
):
    """Second connector must receive graph_state carrying the flow seeded by first."""
    comm1 = _make_communicator(test_graph.pk, test_user)
    await comm1.connect()
    await comm1.receive_json_from()  # presence_state
    await comm1.receive_json_from()  # request_state
    await comm1.receive_json_from()  # user_joined

    # Comm1 seeds the live state.
    await comm1.send_json_to({"type": "graph_state", "flow": _SAMPLE_FLOW})

    comm2 = _make_communicator(test_graph.pk, second_user)
    await comm2.connect()
    await comm1.receive_json_from()  # user_joined for second_user

    await comm2.receive_json_from()  # presence_state

    msg = await comm2.receive_json_from()
    assert msg["type"] == "graph_state"
    assert msg["flow"] == _SAMPLE_FLOW

    await comm2.receive_json_from()  # user_joined
    await comm1.disconnect()
    await comm2.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_node_created_op_mutates_snapshot(test_graph, test_user):
    """node_created op must be reflected in the stored snapshot."""
    comm = _make_communicator(test_graph.pk, test_user)
    await comm.connect()
    await _drain_connect(comm)

    # Seed the live state first.
    await comm.send_json_to({"type": "graph_state", "flow": _SAMPLE_FLOW})

    # Send a node_created op.
    await comm.send_json_to(
        {
            "type": "node_created",
            "node": {"id": "n2", "type": "code"},
            "editor": {
                "user_id": test_user.pk,
                "display_name": "x",
                "avatar_url": None,
            },
        }
    )

    assert await _wait_for(lambda: graph_state_service.get_snapshot(test_graph.pk))
    snapshot = await graph_state_service.get_snapshot(test_graph.pk)
    assert snapshot is not None
    node_ids = {n["id"] for n in snapshot["nodes"]}
    assert "n1" in node_ids
    assert "n2" in node_ids

    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_graph_state_seed_does_not_overwrite_existing_snapshot(
    test_graph, test_user
):
    """A second graph_state C→S must NOT overwrite an already-seeded snapshot."""
    comm = _make_communicator(test_graph.pk, test_user)
    await comm.connect()
    await _drain_connect(comm)

    first_flow = {"nodes": [{"id": "original"}], "connections": []}
    second_flow = {"nodes": [{"id": "overwrite_attempt"}], "connections": []}

    await comm.send_json_to({"type": "graph_state", "flow": first_flow})

    assert await _wait_for(lambda: graph_state_service.get_snapshot(test_graph.pk))

    await comm.send_json_to({"type": "graph_state", "flow": second_flow})
    await _wait_for(lambda: graph_state_service.get_snapshot(test_graph.pk))

    snapshot = await graph_state_service.get_snapshot(test_graph.pk)
    assert snapshot is not None
    assert snapshot["nodes"][0]["id"] == "original"

    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_last_disconnect_clears_snapshot(test_graph, test_user):
    """Snapshot must be cleared once the last editor leaves."""
    comm = _make_communicator(test_graph.pk, test_user)
    await comm.connect()
    await _drain_connect(comm)

    await comm.send_json_to({"type": "graph_state", "flow": _SAMPLE_FLOW})

    assert await _wait_for(lambda: graph_state_service.get_snapshot(test_graph.pk))

    assert await graph_state_service.get_snapshot(test_graph.pk) is not None

    await comm.disconnect()

    async def _snapshot_cleared():
        return await graph_state_service.get_snapshot(test_graph.pk) is None

    assert await _wait_for(_snapshot_cleared)
