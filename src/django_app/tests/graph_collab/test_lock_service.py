"""Unit tests for NodeLockService (pure in-memory, no DB/Redis needed)."""

import pytest

from tables.graph_collab.lock_service import NodeLockService
from tables.graph_collab.protocol import EditorInfo


@pytest.fixture
def lock_service():
    return NodeLockService()


@pytest.fixture
def editor_a():
    return EditorInfo(user_id=1, display_name="Alice", avatar_url=None)


@pytest.fixture
def editor_b():
    return EditorInfo(user_id=2, display_name="Bob", avatar_url=None)


GRAPH_ID = 42
NODE_ID = "node-1"
CHANNEL_A = "specific.channel.abc"
CHANNEL_B = "specific.channel.xyz"


# ---------------------------------------------------------------------------
# try_lock
# ---------------------------------------------------------------------------


def test_try_lock_on_free_node_succeeds(lock_service, editor_a):
    granted = lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    assert granted is True


def test_try_lock_records_entry(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    entry = lock_service.get_holder(GRAPH_ID, NODE_ID)
    assert entry is not None
    assert entry.editor == editor_a
    assert entry.channel == CHANNEL_A


def test_try_lock_second_channel_loses_race(lock_service, editor_a, editor_b):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    granted = lock_service.try_lock(GRAPH_ID, NODE_ID, editor_b, CHANNEL_B)
    assert granted is False


def test_try_lock_second_channel_does_not_replace_holder(
    lock_service, editor_a, editor_b
):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_b, CHANNEL_B)
    entry = lock_service.get_holder(GRAPH_ID, NODE_ID)
    assert entry is not None
    assert entry.channel == CHANNEL_A


def test_try_lock_same_channel_relock_succeeds(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    granted = lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    assert granted is True


def test_try_lock_same_channel_relock_updates_entry(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    entry = lock_service.get_holder(GRAPH_ID, NODE_ID)
    assert entry is not None
    assert entry.editor == editor_a


# ---------------------------------------------------------------------------
# get_holder
# ---------------------------------------------------------------------------


def test_get_holder_returns_none_for_unlocked_node(lock_service):
    assert lock_service.get_holder(GRAPH_ID, NODE_ID) is None


def test_get_holder_returns_none_for_unknown_graph(lock_service):
    assert lock_service.get_holder(999, NODE_ID) is None


# ---------------------------------------------------------------------------
# release
# ---------------------------------------------------------------------------


def test_release_by_owner_returns_true(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    released = lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_A)
    assert released is True


def test_release_by_owner_clears_lock(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_A)
    assert lock_service.get_holder(GRAPH_ID, NODE_ID) is None


def test_release_by_non_owner_returns_false(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    released = lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_B)
    assert released is False


def test_release_by_non_owner_leaves_lock_intact(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_B)
    assert lock_service.get_holder(GRAPH_ID, NODE_ID) is not None


def test_release_on_unheld_node_returns_false(lock_service):
    released = lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_A)
    assert released is False


def test_release_cleans_up_empty_graph_dict(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.release(GRAPH_ID, NODE_ID, CHANNEL_A)
    assert GRAPH_ID not in lock_service._store


# ---------------------------------------------------------------------------
# release_all_for_channel
# ---------------------------------------------------------------------------


def test_release_all_for_channel_returns_held_node_ids(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, "node-1", editor_a, CHANNEL_A)
    lock_service.try_lock(GRAPH_ID, "node-2", editor_a, CHANNEL_A)
    released = lock_service.release_all_for_channel(GRAPH_ID, CHANNEL_A)
    assert set(released) == {"node-1", "node-2"}


def test_release_all_for_channel_removes_locks(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, "node-1", editor_a, CHANNEL_A)
    lock_service.try_lock(GRAPH_ID, "node-2", editor_a, CHANNEL_A)
    lock_service.release_all_for_channel(GRAPH_ID, CHANNEL_A)
    assert lock_service.get_holder(GRAPH_ID, "node-1") is None
    assert lock_service.get_holder(GRAPH_ID, "node-2") is None


def test_release_all_for_channel_does_not_release_other_channels(
    lock_service, editor_a, editor_b
):
    lock_service.try_lock(GRAPH_ID, "node-1", editor_a, CHANNEL_A)
    lock_service.try_lock(GRAPH_ID, "node-2", editor_b, CHANNEL_B)
    released = lock_service.release_all_for_channel(GRAPH_ID, CHANNEL_A)
    assert released == ["node-1"]
    assert lock_service.get_holder(GRAPH_ID, "node-2") is not None


def test_release_all_for_channel_returns_empty_for_no_locks(lock_service):
    released = lock_service.release_all_for_channel(GRAPH_ID, CHANNEL_A)
    assert released == []


def test_release_all_for_channel_cleans_up_empty_graph_dict(lock_service, editor_a):
    lock_service.try_lock(GRAPH_ID, NODE_ID, editor_a, CHANNEL_A)
    lock_service.release_all_for_channel(GRAPH_ID, CHANNEL_A)
    assert GRAPH_ID not in lock_service._store


# ---------------------------------------------------------------------------
# Graph isolation
# ---------------------------------------------------------------------------


def test_locks_are_isolated_per_graph(lock_service, editor_a, editor_b):
    """A lock on graph A must not interfere with the same node on graph B."""
    lock_service.try_lock(1, NODE_ID, editor_a, CHANNEL_A)
    granted = lock_service.try_lock(2, NODE_ID, editor_b, CHANNEL_B)
    assert granted is True
