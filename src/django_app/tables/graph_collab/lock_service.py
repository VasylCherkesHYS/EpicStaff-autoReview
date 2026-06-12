"""
Per-graph authoritative node lock registry.

Keeps all active node locks in memory.  This is intentionally single-worker
only — no cross-process synchronisation — matching the same assumption used
by GraphPresenceService and GraphLiveStateService.

Structure: {graph_id: {node_id: LockEntry}}
"""

from dataclasses import dataclass

from tables.graph_collab.protocol import EditorInfo


@dataclass
class LockEntry:
    editor: EditorInfo
    channel: str


class NodeLockService:
    """In-memory authoritative registry of per-node edit locks."""

    def __init__(self) -> None:
        # graph_id -> {node_id -> LockEntry}
        self._store: dict[int, dict[str, LockEntry]] = {}

    def try_lock(
        self,
        graph_id: int,
        node_id: str,
        editor: EditorInfo,
        channel: str,
    ) -> bool:
        """Attempt to acquire (or refresh) a lock on *node_id* for *channel*.

        Returns True when the lock is granted or already held by the same
        channel (re-lock / field change by the same owner is allowed and
        updates the stored field).  Returns False when a different channel
        already holds the lock.
        """
        graph_locks = self._store.setdefault(graph_id, {})
        existing = graph_locks.get(node_id)
        if existing is not None and existing.channel != channel:
            return False
        graph_locks[node_id] = LockEntry(editor=editor, channel=channel)
        return True

    def get_holder(self, graph_id: int, node_id: str) -> LockEntry | None:
        """Return the current lock holder for *node_id*, or None if unheld."""
        return self._store.get(graph_id, {}).get(node_id)

    def release(self, graph_id: int, node_id: str, channel: str) -> bool:
        """Release the lock on *node_id* if *channel* is the current holder.

        Returns True if a lock was released, False otherwise (not held or
        held by a different channel).
        """
        graph_locks = self._store.get(graph_id)
        if not graph_locks:
            return False
        existing = graph_locks.get(node_id)
        if existing is None or existing.channel != channel:
            return False
        del graph_locks[node_id]
        if not graph_locks:
            del self._store[graph_id]
        return True

    def release_all_for_channel(self, graph_id: int, channel: str) -> list[str]:
        """Release every lock held by *channel* for *graph_id*.

        Returns the list of node_ids whose locks were released so the caller
        can broadcast NodeUnlockedMessage for each.
        """
        graph_locks = self._store.get(graph_id)
        if not graph_locks:
            return []
        released = [
            node_id
            for node_id, entry in list(graph_locks.items())
            if entry.channel == channel
        ]
        for node_id in released:
            del graph_locks[node_id]
        if not graph_locks:
            del self._store[graph_id]
        return released


lock_service = NodeLockService()
