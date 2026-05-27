"""
ToolRegistry: name-keyed store of callable tool specifications.

``SurfaceResolver`` populates the registry via ``register`` during surface
resolution; ``AgentLoop`` reads the specs via ``tool_specs`` (passed to
``LLMClient.chat``) and dispatches tool calls via ``execute``.
"""

from __future__ import annotations

from typing import Awaitable, Callable

from pydantic import BaseModel, ConfigDict, Field

from app.models import ToolResult


class ToolSpec(BaseModel):
    """Immutable descriptor for a single callable tool.

    ``parameters_schema`` follows JSON Schema draft-7 (OpenAI tool-call
    format) and is passed verbatim to the LLM so it can produce valid
    ``arguments`` JSON.
    """

    model_config = ConfigDict(frozen=True)

    name: str
    description: str
    parameters_schema: dict = Field(default_factory=dict)


class ToolRegistry:
    """Maps tool names to specs and async executor callables.

    ``SurfaceResolver`` per-type resolvers call ``register`` to add each
    tool they resolve from the surface payload.  ``AgentLoop`` calls
    ``tool_specs`` to get the list forwarded to the LLM and ``execute`` to
    run a named tool after the LLM requests it.

    Invariant: ``execute`` must only be called with names that were
    previously passed to ``register``; unknown names raise ``KeyError``.
    """

    def __init__(self) -> None:
        self._specs: dict[str, ToolSpec] = {}
        self._executors: dict[str, Callable[[dict], Awaitable[ToolResult]]] = {}

    def register(
        self,
        spec: ToolSpec,
        executor: Callable[[dict], Awaitable[ToolResult]],
    ) -> None:
        """Register a tool spec and its async executor callable.

        Replaces any existing registration under the same name.
        """
        self._specs[spec.name] = spec
        self._executors[spec.name] = executor

    def tool_specs(self) -> list[ToolSpec]:
        """Return all registered ``ToolSpec`` objects for passing to ``LLMClient.chat``."""
        return list(self._specs.values())

    async def execute(self, name: str, args: dict) -> ToolResult:
        """Dispatch a tool call by name and return its result.

        Args:
            name: must match a previously registered ``ToolSpec.name``.
            args: parsed JSON arguments from the LLM tool-call request.

        Raises:
            KeyError: if ``name`` has not been registered.
        """
        executor = self._executors[name]
        return await executor(args)
