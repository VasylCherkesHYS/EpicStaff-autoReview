import secrets
from typing import Optional

from asgiref.sync import sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django_redis import get_redis_connection


class WsTicketService:
    """
    Single-use, short-lived tickets that authenticate WebSocket connections.
    The client POSTs with JWT to issue a ticket, then opens the WS URL with
    `?ticket=<value>`. Consumed on first use via GETDEL so replay is impossible.

    Intentionally separate from SseTicketService — tokens are non-fungible.
    """

    CACHE_PREFIX = "rbac:ws_ticket:"

    @property
    def _ttl(self) -> int:
        return settings.GRAPH_WS_TICKET_TTL_SECONDS

    def _redis(self):
        return get_redis_connection("default")

    def _key(self, ticket: str) -> str:
        return f"{self.CACHE_PREFIX}{ticket}"

    def issue(self, user) -> str:
        ticket = secrets.token_urlsafe(32)
        self._redis().set(self._key(ticket), user.pk, ex=self._ttl)
        return ticket

    def consume(self, ticket: str) -> Optional[object]:
        if not ticket:
            return None
        raw = self._redis().getdel(self._key(ticket))
        if raw is None:
            return None
        try:
            user_id = int(raw)
        except (TypeError, ValueError):
            return None
        return get_user_model().objects.filter(pk=user_id).first()


_service = WsTicketService()


class TicketAuthMiddleware(BaseMiddleware):
    """
    ASGI middleware that resolves a ?ticket=<value> query param into a User
    and sets scope["user"]. Sets AnonymousUser when the ticket is missing or
    expired — the consumer decides whether to reject the connection.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        ticket = self._extract_ticket(query_string)
        scope["user"] = await sync_to_async(_service.consume)(ticket) or AnonymousUser()
        await super().__call__(scope, receive, send)

    @staticmethod
    def _extract_ticket(query_string: str) -> str:
        for part in query_string.split("&"):
            if part.startswith("ticket="):
                return part[len("ticket=") :]
        return ""
