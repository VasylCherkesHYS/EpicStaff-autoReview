import pydantic
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from pydantic import BaseModel

from tables.graph_collab.presence_service import presence_service
from tables.graph_collab.protocol import (
    ConnectionCreatedMessage,
    ConnectionDeletedMessage,
    ConnectionsDeletedMessage,
    ConnectionWaypointsUpdatedMessage,
    CursorMovedMessage,
    EditorInfo,
    ErrorMessage,
    NodeCreatedMessage,
    NodeLockedMessage,
    NodeUnlockedMessage,
    NodeUpdatedMessage,
    NodesDeletedMessage,
    PresenceStateMessage,
    SelectionChangedMessage,
    UserJoinedMessage,
    UserLeftMessage,
)
from utils.logger import logger

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
    "node_locked": NodeLockedMessage,
    "node_unlocked": NodeUnlockedMessage,
}


def _group_name(graph_id: int) -> str:
    return f"graph_edit_{graph_id}"


class GraphEditConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for graph co-editing events.

    Clients connect to /ws/graphs/{graph_id}/edit/?ticket=<token>.
    After connect they can send canvas-edit messages which are relayed
    to all other consumers for the same graph. graph_saved events are pushed
    from HTTP views via GraphEditNotifier.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser):
            await self.close(code=4401)
            return

        graph_id_str = self.scope["url_route"]["kwargs"]["graph_id"]
        try:
            self.graph_id = int(graph_id_str)
        except (ValueError, TypeError):
            await self.close(code=4400)
            return

        exists = await sync_to_async(self._graph_exists)(self.graph_id)
        if not exists:
            await self.close(code=4404)
            return

        self.group = _group_name(self.graph_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        logger.info(
            "User {} connected to graph {} edit channel", user.pk, self.graph_id
        )

        editor = self._build_editor_info(user)
        presence_service.add(self.graph_id, self.channel_name, editor)

        await self.send_json(
            PresenceStateMessage(
                editors=presence_service.get_editors(self.graph_id),
            ).model_dump()
        )

        await self.channel_layer.group_send(
            self.group,
            UserJoinedMessage(editor=editor).model_dump(),
        )

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            graph_id = getattr(self, "graph_id", None)
            user = self.scope.get("user")
            if graph_id is not None:
                presence_service.remove(graph_id, self.channel_name)
                if user and not isinstance(user, AnonymousUser):
                    await self.channel_layer.group_send(
                        group,
                        UserLeftMessage(user_id=user.pk).model_dump(),
                    )
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        model_class = _RELAY_MESSAGE_TYPES.get(message_type)
        if model_class is not None:
            await self._handle_relay(content, model_class)
        else:
            await self.send_json(
                ErrorMessage(
                    code="unknown_message_type",
                    message=f"Unknown message type: {message_type!r}",
                ).model_dump()
            )

    async def _handle_relay(self, content: dict, model_class: type[BaseModel]) -> None:
        try:
            message = model_class.model_validate(content)
        except pydantic.ValidationError as exc:
            await self.send_json(
                ErrorMessage(
                    code="invalid_payload",
                    message=str(exc),
                ).model_dump()
            )
            return

        # Override editor server-side — never trust the client-sent identity.
        message.editor = self._build_editor_info(self.scope["user"])

        event = message.model_dump()
        event["sender_channel"] = self.channel_name
        await self.channel_layer.group_send(self.group, event)

    async def _relay(self, event: dict) -> None:
        """Forward a channel-layer event to the WebSocket, suppressing echo to sender."""
        if event.get("sender_channel") == self.channel_name:
            return
        payload = {
            key: value for key, value in event.items() if key != "sender_channel"
        }
        await self.send_json(payload)

    # --- Channel layer handlers: relay ---

    async def node_created(self, event):
        await self._relay(event)

    async def node_updated(self, event):
        await self._relay(event)

    async def nodes_deleted(self, event):
        await self._relay(event)

    async def connection_created(self, event):
        await self._relay(event)

    async def connection_deleted(self, event):
        await self._relay(event)

    async def connections_deleted(self, event):
        await self._relay(event)

    async def connection_waypoints_updated(self, event):
        await self._relay(event)

    async def cursor_moved(self, event):
        await self._relay(event)

    async def selection_changed(self, event):
        await self._relay(event)

    async def node_locked(self, event):
        await self._relay(event)

    async def node_unlocked(self, event):
        await self._relay(event)

    # --- Channel layer handlers: presence + notifications ---

    async def graph_saved(self, event):
        await self.send_json(event)

    async def user_joined(self, event):
        await self.send_json(event)

    async def user_left(self, event):
        await self.send_json(event)

    async def presence_state(self, event):
        await self.send_json(event)

    # --- Helpers ---

    @staticmethod
    def _build_editor_info(user) -> EditorInfo:
        avatar_url: str | None = None
        avatar = getattr(user, "avatar", None)
        if avatar and avatar.name:
            try:
                avatar_url = avatar.url
            except ValueError:
                avatar_url = None
        return EditorInfo(
            user_id=user.pk,
            display_name=getattr(user, "display_name", None)
            or getattr(user, "email", None),
            avatar_url=avatar_url,
        )

    @staticmethod
    def _graph_exists(graph_id: int) -> bool:
        from tables.models import Graph

        return Graph.objects.filter(pk=graph_id).exists()
