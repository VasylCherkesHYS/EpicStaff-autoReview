"""
Shared Pydantic data-transfer models for the agent service.

These frozen models are the cross-layer contract: ``DataLoader`` produces
``AgentRequest``; ``AgentLoop`` produces ``LoopResult``; ``Emitter`` consumes
both.  All models are immutable (``frozen=True``) to make accidental mutation
obvious.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.enums import RunType
from app.surface.items import SurfaceItem


class AgentConfig(BaseModel):
    """Immutable agent configuration: which model to call and how.

    Carried inside ``AgentRequest`` and consumed by ``AgentContext`` to
    initialise a run.  ``params`` holds arbitrary LiteLLM-compatible
    keyword arguments (temperature, max_tokens, etc.).
    """

    model_config = ConfigDict(frozen=True)

    model: str
    system_prompt: str
    params: dict = Field(default_factory=dict)
    max_execution_time: float | None = None
    """Wall-clock budget in seconds honored by ``DefaultAgentLoop``; ``None`` means no limit."""


class AgentRequest(BaseModel):
    """Fully hydrated input produced by ``DataLoader`` from a stream envelope.

    ``RunnerFactory`` selects a ``Runner`` based on ``run_type``.
    ``surface_items`` are resolved by ``SurfaceResolver`` into tools and
    context attachments before the loop starts.
    """

    model_config = ConfigDict(frozen=True)

    correlation_id: str
    run_type: RunType
    agent_config: AgentConfig
    surface_items: list[SurfaceItem] = Field(default_factory=list)
    payload: dict = Field(default_factory=dict)


class ToolResult(BaseModel):
    """Outcome of a single tool execution dispatched by ``ToolRegistry``.

    ``is_error=True`` signals the loop to treat the content as an error
    message rather than a valid tool response.
    """

    model_config = ConfigDict(frozen=True)

    tool_call_id: str
    content: str
    is_error: bool = False


class ContextAttachment(BaseModel):
    """A message injected into the conversation before the first LLM call.

    Produced by per-type ``ItemResolver`` implementations (e.g. RAG snippets
    prepended as a system message).  ``source`` identifies which surface item
    generated this attachment, for logging and debugging.
    """

    model_config = ConfigDict(frozen=True)

    role: Literal["system", "user"]
    content: str
    source: str


class LoopResult(BaseModel):
    """Summary returned by ``AgentLoop.run`` after the tool-use cycle ends.

    Consumed by ``Emitter.on_final`` to build the outbound result envelope
    published to ``agent.results``.
    """

    model_config = ConfigDict(frozen=True)

    final_text: str | None
    tool_invocations: int
    iterations: int
    stop_reason: str


class ResolvedSurface(BaseModel):
    """Output of ``SurfaceResolver.resolve``: context attachments ready for the loop.

    The ``ToolRegistry`` built during resolution is returned separately by
    ``SurfaceResolver`` and is not embedded here to keep this model serialisable.
    Attachments are injected into ``AgentContext`` before ``AgentLoop.run``
    is called.
    """

    model_config = ConfigDict(frozen=True)

    attachments: list[ContextAttachment] = Field(default_factory=list)
