"""
Unit tests for GraphLiveStateService.

Redis is replaced with fakeredis.aioredis.FakeRedis so the real async
get/set/delete logic runs without a live server.
"""

import pytest

from tables.graph_collab.protocol import (
    ConnectionCreatedMessage,
    ConnectionDeletedMessage,
    ConnectionWaypointsUpdatedMessage,
    ConnectionsDeletedMessage,
    EditorInfo,
    NodeCreatedMessage,
    NodeUpdatedMessage,
    NodesDeletedMessage,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _editor() -> EditorInfo:
    return EditorInfo(user_id=1, display_name="Test", avatar_url=None)


def _flow(nodes=None, connections=None) -> dict:
    return {"nodes": nodes or [], "connections": connections or []}


# ---------------------------------------------------------------------------
# seed / get_snapshot / clear
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seed_and_get_round_trip(service):
    flow = _flow(nodes=[{"id": "n1", "type": "agent"}])
    await service.seed(1, flow)
    result = await service.get_snapshot(1)
    assert result == flow


@pytest.mark.asyncio
async def test_get_snapshot_absent_returns_none(service):
    result = await service.get_snapshot(999)
    assert result is None


@pytest.mark.asyncio
async def test_clear_removes_snapshot(service):
    await service.seed(2, _flow())
    await service.clear(2)
    assert await service.get_snapshot(2) is None


# ---------------------------------------------------------------------------
# apply_op — node ops
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_node_created_adds_node(service):
    await service.seed(1, _flow())
    msg = NodeCreatedMessage(node={"id": "n1", "type": "agent"}, editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["nodes"] == [{"id": "n1", "type": "agent"}]


@pytest.mark.asyncio
async def test_apply_node_updated_replaces_node(service):
    await service.seed(1, _flow(nodes=[{"id": "n1", "type": "agent", "label": "old"}]))
    msg = NodeUpdatedMessage(
        node={"id": "n1", "type": "agent", "label": "new"}, editor=_editor()
    )
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert len(snapshot["nodes"]) == 1
    assert snapshot["nodes"][0]["label"] == "new"


@pytest.mark.asyncio
async def test_apply_node_updated_upserts_when_absent(service):
    await service.seed(1, _flow())
    msg = NodeUpdatedMessage(node={"id": "n99", "type": "code"}, editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert len(snapshot["nodes"]) == 1
    assert snapshot["nodes"][0]["id"] == "n99"


@pytest.mark.asyncio
async def test_apply_nodes_deleted_removes_nodes(service):
    initial_nodes = [{"id": "n1"}, {"id": "n2"}, {"id": "n3"}]
    await service.seed(1, _flow(nodes=initial_nodes))
    msg = NodesDeletedMessage(node_ids=["n1", "n3"], editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["nodes"] == [{"id": "n2"}]


@pytest.mark.asyncio
async def test_apply_nodes_deleted_does_not_touch_connections(service):
    connections = [{"id": "c1", "source": "n1", "target": "n2"}]
    await service.seed(1, _flow(nodes=[{"id": "n1"}], connections=connections))
    msg = NodesDeletedMessage(node_ids=["n1"], editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    # Connections must be untouched — FE sends connection deletions separately.
    assert snapshot["connections"] == connections


# ---------------------------------------------------------------------------
# apply_op — connection ops
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_connection_created_adds_connection(service):
    await service.seed(1, _flow())
    msg = ConnectionCreatedMessage(
        connection={"id": "c1", "source": "n1", "target": "n2"}, editor=_editor()
    )
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["connections"] == [{"id": "c1", "source": "n1", "target": "n2"}]


@pytest.mark.asyncio
async def test_apply_connection_created_upserts_existing(service):
    existing = [{"id": "c1", "source": "n1", "target": "n2"}]
    await service.seed(1, _flow(connections=existing))
    msg = ConnectionCreatedMessage(
        connection={"id": "c1", "source": "n1", "target": "n3"}, editor=_editor()
    )
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert len(snapshot["connections"]) == 1
    assert snapshot["connections"][0]["target"] == "n3"


@pytest.mark.asyncio
async def test_apply_connection_deleted_removes_connection(service):
    connections = [{"id": "c1"}, {"id": "c2"}]
    await service.seed(1, _flow(connections=connections))
    msg = ConnectionDeletedMessage(connection_id="c1", editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["connections"] == [{"id": "c2"}]


@pytest.mark.asyncio
async def test_apply_connections_deleted_removes_batch(service):
    connections = [{"id": "c1"}, {"id": "c2"}, {"id": "c3"}]
    await service.seed(1, _flow(connections=connections))
    msg = ConnectionsDeletedMessage(connection_ids=["c1", "c3"], editor=_editor())
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["connections"] == [{"id": "c2"}]


@pytest.mark.asyncio
async def test_apply_connection_waypoints_updated_sets_waypoints(service):
    connections = [{"id": "c1", "source": "n1", "target": "n2"}]
    await service.seed(1, _flow(connections=connections))
    waypoints = [{"x": 10, "y": 20}, {"x": 30, "y": 40}]
    msg = ConnectionWaypointsUpdatedMessage(
        connection_id="c1", waypoints=waypoints, editor=_editor()
    )
    await service.apply_op(1, msg)
    snapshot = await service.get_snapshot(1)
    assert snapshot["connections"][0]["waypoints"] == waypoints


# ---------------------------------------------------------------------------
# apply_op — safe no-op on absent snapshot
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_op_on_absent_snapshot_is_safe_noop(service):
    msg = NodeCreatedMessage(node={"id": "n1"}, editor=_editor())
    # Must not raise and must not create a snapshot.
    await service.apply_op(999, msg)
    assert await service.get_snapshot(999) is None
