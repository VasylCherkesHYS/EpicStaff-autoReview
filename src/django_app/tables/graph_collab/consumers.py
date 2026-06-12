import asyncio

import pydantic
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from pydantic import BaseModel

from tables.graph_collab.graph_state_service import graph_state_service
from tables.graph_collab.lock_service import lock_service
from tables.graph_collab.presence_service import presence_service
from tables.graph_collab.constants import _RELAY_MESSAGE_TYPES, _STATE_OP_TYPES
from tables.graph_collab.protocol import (
    EditorInfo,
    ErrorMessage,
    GraphStateMessage,
    LockStateMessage,
    NodeLockedMessage,
    NodeUnlockedMessage,
    PresenceStateMessage,
    RequestStateMessage,
    UserJoinedMessage,
    UserLeftMessage,
)

from utils.logger import logger


def _group_name(graph_id: int) -> str:
    return f"graph_edit_{graph_id}"


def _lock_timeout() -> int:
    return getattr(settings, "GRAPH_LOCK_TIMEOUT_SECONDS", 300)


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
        # Per-node asyncio timer handles; keyed by node_id.
        self._lock_timers: dict[str, asyncio.Task] = {}

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

        # Serve live state or ask this client to seed it.
        snapshot = await graph_state_service.get_snapshot(self.graph_id)
        if snapshot is not None:
            await self.send_json(GraphStateMessage(flow=snapshot).model_dump())
        else:
            await self.send_json(RequestStateMessage().model_dump())

        active_locks = lock_service.get_all_locks(self.graph_id)
        if active_locks:
            await self.send_json(
                LockStateMessage(
                    locks={
                        node_id: entry.editor for node_id, entry in active_locks.items()
                    }
                ).model_dump()
            )

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            graph_id = getattr(self, "graph_id", None)
            user = self.scope.get("user")
            if graph_id is not None:
                # Cancel all pending lock timers before releasing locks.
                for timer in getattr(self, "_lock_timers", {}).values():
                    timer.cancel()

                # Release all locks held by this channel and broadcast unlocks.
                released_node_ids = lock_service.release_all_for_channel(
                    graph_id, self.channel_name
                )
                if released_node_ids and user and not isinstance(user, AnonymousUser):
                    editor = self._build_editor_info(user)
                    for node_id in released_node_ids:
                        event = NodeUnlockedMessage(
                            node_id=node_id, editor=editor
                        ).model_dump()
                        event["sender_channel"] = self.channel_name
                        await self.channel_layer.group_send(self.group, event)

                presence_service.remove(graph_id, self.channel_name)
                if user and not isinstance(user, AnonymousUser):
                    await self.channel_layer.group_send(
                        group,
                        UserLeftMessage(user_id=user.pk).model_dump(),
                    )
                # Clear live snapshot once the last editor leaves.
                if presence_service.count_editors(graph_id) == 0:
                    await graph_state_service.clear(graph_id)
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")

        # Handle Client→Server graph_state seed before relay lookup.
        if message_type == "graph_state":
            try:
                message = GraphStateMessage.model_validate(content)
            except pydantic.ValidationError as exc:
                await self.send_json(
                    ErrorMessage(
                        code="invalid_payload",
                        message=str(exc),
                    ).model_dump()
                )
                return
            # Seed only if absent — never let a late client clobber the snapshot.
            if await graph_state_service.get_snapshot(self.graph_id) is None:
                await graph_state_service.seed(self.graph_id, message.flow)
            return

        # Handle lock claim — arbitrated through lock_service, not blindly relayed.
        if message_type == "node_locked":
            await self._handle_node_locked(content)
            return

        # Handle lock release — arbitrated through lock_service.
        if message_type == "node_unlocked":
            await self._handle_node_unlocked(content)
            return

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

    async def _handle_node_locked(self, content: dict) -> None:
        try:
            message = NodeLockedMessage.model_validate(content)
        except pydantic.ValidationError as exc:
            await self.send_json(
                ErrorMessage(code="invalid_payload", message=str(exc)).model_dump()
            )
            return

        # Override editor server-side — never trust the client-sent identity.
        editor = self._build_editor_info(self.scope["user"])
        message.editor = editor

        granted = lock_service.try_lock(
            self.graph_id,
            message.node_id,
            editor,
            self.channel_name,
        )

        if granted:
            self._schedule_lock_timer(message.node_id, editor)
            event = message.model_dump()
            event["sender_channel"] = self.channel_name
            await self.channel_layer.group_send(self.group, event)
        else:
            # Send corrective signal to the loser — describes the current holder.
            holder = lock_service.get_holder(self.graph_id, message.node_id)
            if holder is None:
                # Holder vanished between try_lock and get_holder — harmless, skip.
                return
            await self.send_json(
                NodeLockedMessage(
                    node_id=message.node_id,
                    editor=holder.editor,
                ).model_dump()
            )

    async def _handle_node_unlocked(self, content: dict) -> None:
        try:
            message = NodeUnlockedMessage.model_validate(content)
        except pydantic.ValidationError as exc:
            await self.send_json(
                ErrorMessage(code="invalid_payload", message=str(exc)).model_dump()
            )
            return

        released = lock_service.release(
            self.graph_id, message.node_id, self.channel_name
        )
        if not released:
            # Non-owner or already released — silently discard; no broadcast.
            return

        self._cancel_lock_timer(message.node_id)

        # Override editor server-side before relaying.
        message.editor = self._build_editor_info(self.scope["user"])
        event = message.model_dump()
        event["sender_channel"] = self.channel_name
        await self.channel_layer.group_send(self.group, event)

    # --- Backstop inactivity timer ---

    def _schedule_lock_timer(self, node_id: str, editor: EditorInfo) -> None:
        """Schedule (or reset) a backstop timer that auto-releases *node_id* after
        GRAPH_LOCK_TIMEOUT_SECONDS.  The timer lives on the consumer instance so
        that asyncio event-loop concerns stay out of the pure-registry lock_service.
        """
        self._cancel_lock_timer(node_id)
        timeout = _lock_timeout()
        self._lock_timers[node_id] = asyncio.ensure_future(
            self._backstop_release(node_id, editor, timeout)
        )

    def _cancel_lock_timer(self, node_id: str) -> None:
        timer = self._lock_timers.pop(node_id, None)
        if timer is not None:
            timer.cancel()

    async def _backstop_release(
        self, node_id: str, editor: EditorInfo, timeout: int
    ) -> None:
        await asyncio.sleep(timeout)
        released = lock_service.release(self.graph_id, node_id, self.channel_name)
        if not released:
            return
        # TODO(EST-3020 Block 4): flush_to_db on backstop release
        logger.info(
            "Lock backstop: auto-released node {} on graph {} for channel {}",
            node_id,
            self.graph_id,
            self.channel_name,
        )
        event = NodeUnlockedMessage(node_id=node_id, editor=editor).model_dump()
        event["sender_channel"] = self.channel_name
        await self.channel_layer.group_send(self.group, event)

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

        # Apply state-mutating ops to the live snapshot before relaying.
        if message.type in _STATE_OP_TYPES:
            await graph_state_service.apply_op(self.graph_id, message)

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
