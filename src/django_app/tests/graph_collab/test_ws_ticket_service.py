"""
Unit + integration tests for WsTicketService and TicketAuthMiddleware.

Redis is replaced with fakeredis.FakeStrictRedis so the real set/getdel logic
runs without a live Redis server.  DB access is minimal: only user creation
and deletion.
"""

import pytest
import fakeredis
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from tables.graph_collab.ws_auth import TicketAuthMiddleware, WsTicketService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(mocker) -> tuple[WsTicketService, fakeredis.FakeStrictRedis]:
    """Return a service instance wired to a fresh in-memory fakeredis store."""
    fake = fakeredis.FakeStrictRedis()
    mocker.patch(
        "tables.graph_collab.ws_auth.get_redis_connection",
        return_value=fake,
    )
    return WsTicketService(), fake


# ---------------------------------------------------------------------------
# WsTicketService tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_issue_returns_token_and_stores_user(mocker):
    service, fake = _make_service(mocker)
    User = get_user_model()
    user = User.objects.create_user(email="ticket1@example.com", password="Pass123!")

    token = service.issue(user)

    assert isinstance(token, str) and len(token) > 0
    stored = fake.get(service._key(token))
    assert stored is not None
    assert int(stored) == user.pk


@pytest.mark.django_db
def test_consume_valid_ticket_returns_user(mocker):
    service, _ = _make_service(mocker)
    User = get_user_model()
    user = User.objects.create_user(email="ticket2@example.com", password="Pass123!")

    token = service.issue(user)
    result = service.consume(token)

    assert result is not None
    assert result.pk == user.pk


@pytest.mark.django_db
def test_consume_is_single_use(mocker):
    service, _ = _make_service(mocker)
    User = get_user_model()
    user = User.objects.create_user(email="ticket3@example.com", password="Pass123!")

    token = service.issue(user)

    first = service.consume(token)
    assert first is not None

    second = service.consume(token)
    assert second is None


@pytest.mark.django_db
def test_consume_empty_or_none_ticket_returns_none(mocker):
    service, fake = _make_service(mocker)

    assert service.consume("") is None
    assert service.consume(None) is None  # type: ignore[arg-type]
    # No redis hit expected — early return before key lookup.
    assert fake.dbsize() == 0


@pytest.mark.django_db
def test_consume_unknown_ticket_returns_none(mocker):
    service, _ = _make_service(mocker)

    result = service.consume("completely-unknown-token")

    assert result is None


@pytest.mark.django_db
def test_consume_corrupted_value_returns_none(mocker):
    service, fake = _make_service(mocker)

    fake.set(service._key("bad"), b"not-an-int")
    result = service.consume("bad")

    assert result is None


@pytest.mark.django_db
def test_consume_deleted_user_returns_none(mocker):
    service, _ = _make_service(mocker)
    User = get_user_model()
    user = User.objects.create_user(email="ticket4@example.com", password="Pass123!")

    token = service.issue(user)
    user.delete()

    result = service.consume(token)
    assert result is None


@pytest.mark.django_db
def test_ttl_matches_setting(mocker):
    service, fake = _make_service(mocker)
    User = get_user_model()
    user = User.objects.create_user(email="ticket5@example.com", password="Pass123!")

    token = service.issue(user)
    ttl = fake.ttl(service._key(token))

    assert ttl > 0
    assert ttl <= settings.GRAPH_WS_TICKET_TTL_SECONDS


# ---------------------------------------------------------------------------
# TicketAuthMiddleware._extract_ticket (pure, no I/O)
# ---------------------------------------------------------------------------


def test_extract_ticket_simple():
    assert TicketAuthMiddleware._extract_ticket("ticket=abc") == "abc"


def test_extract_ticket_among_params():
    assert TicketAuthMiddleware._extract_ticket("foo=1&ticket=abc&bar=2") == "abc"


def test_extract_ticket_not_present():
    assert TicketAuthMiddleware._extract_ticket("foo=1&bar=2") == ""


def test_extract_ticket_empty_string():
    assert TicketAuthMiddleware._extract_ticket("") == ""


# ---------------------------------------------------------------------------
# TicketAuthMiddleware.__call__ (async, uses fake redis)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_middleware_sets_user_for_valid_ticket(mocker):
    from asgiref.sync import sync_to_async

    fake = fakeredis.FakeStrictRedis()
    mocker.patch(
        "tables.graph_collab.ws_auth.get_redis_connection",
        return_value=fake,
    )
    service = WsTicketService()
    # Patch the module-level singleton so TicketAuthMiddleware uses the same instance.
    mocker.patch("tables.graph_collab.ws_auth._service", service)

    User = get_user_model()
    user = await sync_to_async(User.objects.create_user)(
        email="mw1@example.com", password="Pass123!"
    )
    token = service.issue(user)

    captured: dict = {}

    async def inner(scope, receive, send):
        captured["user"] = scope["user"]

    middleware = TicketAuthMiddleware(inner)
    scope = {
        "type": "websocket",
        "query_string": f"ticket={token}".encode(),
    }
    await middleware(scope, None, None)

    assert "user" in captured
    assert captured["user"].pk == user.pk


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_middleware_sets_anonymous_for_missing_ticket(mocker):
    fake = fakeredis.FakeStrictRedis()
    mocker.patch(
        "tables.graph_collab.ws_auth.get_redis_connection",
        return_value=fake,
    )

    captured: dict = {}

    async def inner(scope, receive, send):
        captured["user"] = scope["user"]

    middleware = TicketAuthMiddleware(inner)
    scope = {
        "type": "websocket",
        "query_string": b"",
    }
    await middleware(scope, None, None)

    assert "user" in captured
    assert isinstance(captured["user"], AnonymousUser)
