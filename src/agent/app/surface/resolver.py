"""
SurfaceResolver: converts a list of typed surface items into a
``(ToolRegistry, list[ContextAttachment])`` pair for the agent loop.

``SurfaceResolver`` is the open/closed extension point for new surface item
types.  The core loop never needs to change; new types plug in by
implementing ``ItemResolver`` and calling ``SurfaceResolver.register``.
"""

from __future__ import annotations

from typing import Protocol

from app.exceptions import UnknownSurfaceItemTypeError
from app.models import ContextAttachment, ResolvedSurface
from app.surface.items import SurfaceItem
from app.tools.registry import ToolRegistry


class ItemResolver(Protocol):
    """Protocol (structural interface) for per-surface-item-type resolvers.

    Each implementation handles exactly one ``SurfaceItem`` subtype and
    decides whether that item produces a callable tool (registered in
    ``registry``) or a context attachment (appended to ``attachments``), or
    both.

    Concrete implementations for ``ToolItem``, ``RAGItem``, and ``S3Item``
    are follow-up plan work — see plan §'What is NOT in this plan'.
    """

    async def resolve(
        self,
        item: SurfaceItem,
        registry: ToolRegistry,
        attachments: list[ContextAttachment],
    ) -> None:
        """Resolve ``item`` and mutate ``registry`` and/or ``attachments`` in place.

        Subclasses must not raise for expected item shapes; they should
        produce an empty result or a ``ContextAttachment`` describing the
        failure so the loop can surface it gracefully.
        """
        ...


class SurfaceResolver:
    """Iterates surface items and delegates each to its registered ``ItemResolver``.

    Raises ``UnknownSurfaceItemTypeError`` if any item's ``type`` has no
    registered resolver, following the fail-fast approach: a misconfigured
    surface payload is a programming error, not a recoverable runtime
    condition.

    Usage:
        resolver = SurfaceResolver()
        resolver.register("tool", MyToolItemResolver())
        resolved = await resolver.resolve(request.surface_items)
    """

    def __init__(self) -> None:
        self._resolvers: dict[str, ItemResolver] = {}

    def register(self, item_type: str, resolver: ItemResolver) -> None:
        """Register an ``ItemResolver`` for the given ``item_type`` string.

        ``item_type`` must match the ``Literal`` value on the corresponding
        ``SurfaceItem`` subclass (e.g. ``"tool"``, ``"rag"``, ``"s3"``).
        Replaces any existing registration for that type.
        """
        self._resolvers[item_type] = resolver

    async def resolve(self, items: list[SurfaceItem]) -> ResolvedSurface:
        """Resolve all surface items into a ``ResolvedSurface``.

        Iterates ``items``, looks up the registered ``ItemResolver`` for
        each item's ``type``, and calls ``resolver.resolve``.  The
        ``ToolRegistry`` built during resolution is embedded inside each
        resolver call; ``ResolvedSurface`` carries only the attachments.

        Raises:
            UnknownSurfaceItemTypeError: if any item's ``type`` has no
                registered resolver.
        """
        registry = ToolRegistry()
        attachments: list[ContextAttachment] = []

        for item in items:
            item_type = item.type

            if item_type not in self._resolvers:
                raise UnknownSurfaceItemTypeError(
                    f"No resolver registered for surface item type '{item_type}'"
                )

            resolver = self._resolvers[item_type]
            await resolver.resolve(item, registry, attachments)

        return ResolvedSurface(attachments=attachments)
