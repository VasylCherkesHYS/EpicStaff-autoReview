from pydantic import BaseModel

from tables.graph_collab.protocol import (
    ConnectionCreatedMessage,
    ConnectionDeletedMessage,
    ConnectionsDeletedMessage,
    ConnectionWaypointsUpdatedMessage,
    CursorMovedMessage,
    NodeCreatedMessage,
    NodeUpdatedMessage,
    NodesDeletedMessage,
    SelectionChangedMessage,
)

_RELAY_MESSAGE_TYPES: dict[str, type[BaseModel]] = {
    "node_created": NodeCreatedMessage,
    "node_updated": NodeUpdatedMessage,
    "nodes_deleted": NodesDeletedMessage,
    "connection_created": ConnectionCreatedMessage,
    "connection_deleted": ConnectionDeletedMessage,
    "connections_deleted": ConnectionsDeletedMessage,
    "connection_waypoints_updated": ConnectionWaypointsUpdatedMessage,
    "cursor_moved": CursorMovedMessage,
    "selection_changed": SelectionChangedMessage,
}

# Op types that mutate the live graph snapshot — must be applied via apply_op.
_STATE_OP_TYPES: frozenset[str] = frozenset(
    {
        "node_created",
        "node_updated",
        "nodes_deleted",
        "connection_created",
        "connection_deleted",
        "connections_deleted",
        "connection_waypoints_updated",
    }
)
