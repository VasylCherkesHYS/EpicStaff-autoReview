"""
Per-graph live snapshot service.

Keeps an authoritative FlowModel JSON blob in Redis so late-joining editors
receive the current unsaved state, not the last DB-saved version.

Key:   graph:live:{graph_id}
Value: JSON-encoded FlowModel { nodes: [...], connections: [...] }
TTL:   GRAPH_LIVE_STATE_TTL_SECONDS (safety net; real cleanup is last-leave clear)

Concurrent apply_op calls for the same graph are serialised with a per-graph
asyncio.Lock so read-modify-write cycles never lose updates in the single worker.
"""

import asyncio
import json

from django.conf import settings

from tables.graph_collab.protocol import (
    ConnectionCreatedMessage,
    ConnectionDeletedMessage,
    ConnectionWaypointsUpdatedMessage,
    ConnectionsDeletedMessage,
    NodeCreatedMessage,
    NodeUpdatedMessage,
    NodesDeletedMessage,
)
from tables.services.redis_service import RedisService
from utils.logger import logger


def _redis_key(graph_id: int) -> str:
    return f"graph:live:{graph_id}"


class GraphLiveStateService:
    """Maintains per-graph authoritative live snapshots in Redis."""

    def __init__(self) -> None:
        # Lazily-created per-graph asyncio locks to serialise apply_op.
        self._locks: dict[int, asyncio.Lock] = {}

    def _get_lock(self, graph_id: int) -> asyncio.Lock:
        if graph_id not in self._locks:
            self._locks[graph_id] = asyncio.Lock()
        return self._locks[graph_id]

    @property
    def _redis(self):
        """Resolve the async Redis client lazily so tests can patch it."""
        return RedisService().async_redis_client

    async def seed(self, graph_id: int, flow: dict) -> None:
        """Store *flow* as the live snapshot for *graph_id* with a safety TTL."""
        key = _redis_key(graph_id)
        ttl = getattr(settings, "GRAPH_LIVE_STATE_TTL_SECONDS", 86400)
        await self._redis.set(key, json.dumps(flow), ex=ttl)
        logger.debug("Seeded live state for graph {}", graph_id)

    async def get_snapshot(self, graph_id: int) -> dict | None:
        """Return the live snapshot for *graph_id*, or None if absent."""
        raw = await self._redis.get(_redis_key(graph_id))
        if raw is None:
            return None
        return json.loads(raw)

    async def clear(self, graph_id: int) -> None:
        """Delete the live snapshot for *graph_id* (called when last editor leaves)."""
        await self._redis.delete(_redis_key(graph_id))
        logger.debug("Cleared live state for graph {}", graph_id)
        # Release the lock entry — it will be recreated on next use.
        self._locks.pop(graph_id, None)

    async def apply_op(self, graph_id: int, message) -> None:
        """Mutate the stored snapshot according to *message*.

        If no snapshot exists yet (race between seed and op), the op is dropped
        silently — the real state will arrive via seed shortly after.

        All mutation for a given graph_id is serialised with an asyncio.Lock to
        prevent lost-update races in the single async worker.
        """
        async with self._get_lock(graph_id):
            snapshot = await self.get_snapshot(graph_id)
            if snapshot is None:
                logger.debug(
                    "apply_op: no snapshot for graph {} yet — dropping op {}",
                    graph_id,
                    getattr(message, "type", "?"),
                )
                return

            nodes: list[dict] = snapshot.setdefault("nodes", [])
            connections: list[dict] = snapshot.setdefault("connections", [])

            # TODO should I rewrite it with strategy pattern, so no long if-else block?
            if isinstance(message, NodeCreatedMessage | NodeUpdatedMessage):
                node = message.node
                node_id = node["id"]
                for index, existing in enumerate(nodes):
                    if existing["id"] == node_id:
                        nodes[index] = node
                        break
                else:
                    nodes.append(node)

            elif isinstance(message, NodesDeletedMessage):
                ids_to_delete = set(message.node_ids)
                snapshot["nodes"] = [n for n in nodes if n["id"] not in ids_to_delete]

            elif isinstance(message, ConnectionCreatedMessage):
                connection = message.connection
                connection_id = connection["id"]
                for index, existing in enumerate(connections):
                    if existing["id"] == connection_id:
                        connections[index] = connection
                        break
                else:
                    connections.append(connection)

            elif isinstance(message, ConnectionDeletedMessage):
                snapshot["connections"] = [
                    c for c in connections if c["id"] != message.connection_id
                ]

            elif isinstance(message, ConnectionsDeletedMessage):
                ids_to_delete = set(message.connection_ids)
                snapshot["connections"] = [
                    c for c in connections if c["id"] not in ids_to_delete
                ]

            elif isinstance(message, ConnectionWaypointsUpdatedMessage):
                for connection in connections:
                    if connection["id"] == message.connection_id:
                        connection["waypoints"] = message.waypoints
                        break

            await self.seed(graph_id, snapshot)


graph_state_service = GraphLiveStateService()
