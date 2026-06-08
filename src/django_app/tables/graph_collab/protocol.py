from pydantic import BaseModel, ConfigDict


class EditorInfo(BaseModel):
    user_id: int
    display_name: str | None
    avatar_url: str | None

    model_config = ConfigDict(from_attributes=True)


# --- Server-push messages (outbound only) ---


class GraphSavedMessage(BaseModel):
    type: str = "graph_saved"
    graph_id: int
    new_save_version: int
    saved_by: EditorInfo
    saved_at: str


class PresenceStateMessage(BaseModel):
    type: str = "presence_state"
    editors: list[EditorInfo]


class UserJoinedMessage(BaseModel):
    type: str = "user_joined"
    editor: EditorInfo


class UserLeftMessage(BaseModel):
    type: str = "user_left"
    user_id: int


class ErrorMessage(BaseModel):
    type: str = "error"
    code: str
    message: str


class NodeCreatedMessage(BaseModel):
    type: str = "node_created"
    node: dict
    editor: EditorInfo


class NodeUpdatedMessage(BaseModel):
    type: str = "node_updated"
    node: dict
    editor: EditorInfo


class NodesDeletedMessage(BaseModel):
    type: str = "nodes_deleted"
    node_ids: list[str]
    editor: EditorInfo


class ConnectionCreatedMessage(BaseModel):
    type: str = "connection_created"
    connection: dict
    editor: EditorInfo


class ConnectionDeletedMessage(BaseModel):
    type: str = "connection_deleted"
    connection_id: str
    editor: EditorInfo


class ConnectionsDeletedMessage(BaseModel):
    type: str = "connections_deleted"
    connection_ids: list[str]
    editor: EditorInfo


class ConnectionWaypointsUpdatedMessage(BaseModel):
    type: str = "connection_waypoints_updated"
    connection_id: str
    waypoints: list[dict]
    editor: EditorInfo


class CursorMovedMessage(BaseModel):
    type: str = "cursor_moved"
    x: float
    y: float
    editor: EditorInfo


class SelectionChangedMessage(BaseModel):
    type: str = "selection_changed"
    node_ids: list[str]
    editor: EditorInfo


class NodeLockedMessage(BaseModel):
    type: str = "node_locked"
    node_id: str
    field: str | None = None
    editor: EditorInfo


class NodeUnlockedMessage(BaseModel):
    type: str = "node_unlocked"
    node_id: str
    editor: EditorInfo
