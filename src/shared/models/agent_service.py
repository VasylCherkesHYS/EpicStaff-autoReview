"""
Contract DTOs for the agent microservice request/response cycle.

These frozen models are the single source of truth shared between the agent
service producer (django_app / DataLoader) and the agent service consumer
(AgentLoop, Emitter, AgentResolver).

Hierarchy
---------
``AgentRequest``  — top-level envelope produced by ``DataLoader``.
    ``AgentSpec``     — per-agent configuration with resource references.
    ``BaseToolData``  — (imported from shared.models.tools) pool entry.
    ``RagSpec``       — pool entry for a RAG collection.
    ``S3FileSpec``    — pool entry for an S3-hosted file.
``RunType``       — execution-mode enum; kept here so no agent→shared dep exists.
``LoopResult``    — summary returned by ``AgentLoop.run``.
``ToolResult``    — outcome of a single tool execution.
``ContextAttachment`` — message injected before the first LLM call.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .ai_providers import EmbedderData, LLMData
from .knowledge import RagSearchConfig
from .tools import BaseToolData


class RunType(str, Enum):
    """Execution mode for an agent request.

    ``SINGLE_TASK`` — one prompt, one ``AgentLoop`` invocation.
    ``LIST_OF_TASKS`` — sequential list of prompts, each run through the loop.
    ``CHAT`` and ``TEAM`` are reserved for future runner implementations.
    """

    SINGLE_TASK = "SINGLE_TASK"
    LIST_OF_TASKS = "LIST_OF_TASKS"


class AgentSpec(BaseModel):
    """Immutable per-agent configuration with resource references.

    ``tool_refs``, ``rag_refs``, and ``s3_refs`` are identifiers into the
    top-level resource pools on ``AgentRequest``.  ``AgentResolver`` resolves
    them into live executors / attachments before the loop starts.
    """

    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    role: str
    instructions: str
    llm: LLMData
    fcm_llm: LLMData | None = None
    max_iter: int | None = None
    max_rpm: int | None = None
    max_execution_time: float | None = None
    """Wall-clock budget in seconds honored by ``DefaultAgentLoop``; ``None`` means no limit."""
    cache: bool | None = None
    max_retry_limit: int | None = None
    """Maximum LLM call retry attempts; ``None`` uses the client default."""
    default_temperature: float | None = None
    tool_refs: list[str] = Field(default_factory=list)
    """unique_name values referencing entries in ``AgentRequest.tools``."""
    rag_refs: list[str] = Field(default_factory=list)
    """unique_name values referencing entries in ``AgentRequest.rags``."""
    s3_refs: list[int] = Field(default_factory=list)
    """id values referencing entries in ``AgentRequest.s3_files``."""


class RagSpec(BaseModel):
    """Immutable pool entry for a RAG collection.

    Carried on ``AgentRequest.rags``; referenced by ``AgentSpec.rag_refs``
    via ``unique_name``.  RAG execution is out of scope for this pass —
    ``AgentResolver`` validates presence and carries the spec without building
    an executor.
    """

    model_config = ConfigDict(frozen=True)

    unique_name: str
    collection_id: int
    rag_id: int
    rag_type: Literal["naive", "graph"]
    search_config: RagSearchConfig
    embedder: EmbedderData


class S3FileSpec(BaseModel):
    """Immutable pool entry for an S3-hosted file.

    Carried on ``AgentRequest.s3_files``; referenced by ``AgentSpec.s3_refs``
    via ``id``.  S3 resolution is out of scope for this pass — ``AgentResolver``
    validates presence and carries the path without fetching content.
    """

    model_config = ConfigDict(frozen=True)

    id: int
    path: str
    metadata: dict = Field(default_factory=dict)


class AgentRequest(BaseModel):
    """Fully hydrated input produced by ``DataLoader`` from a Redis stream envelope.

    ``correlation_id`` is injected by ``DataLoader`` from the envelope; it is
    NOT present in the wire JSON blob stored at the Redis key.  ``RunnerFactory``
    selects a ``Runner`` based on ``run_type``.  ``AgentResolver`` resolves
    per-agent resource refs against the top-level pools (``tools``, ``rags``,
    ``s3_files``).
    """

    model_config = ConfigDict(frozen=True)

    correlation_id: str
    run_type: RunType
    agents: list[AgentSpec]
    tools: list[BaseToolData] = Field(default_factory=list)
    rags: list[RagSpec] = Field(default_factory=list)
    s3_files: list[S3FileSpec] = Field(default_factory=list)
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

    Produced by per-type resolvers (e.g. RAG snippets prepended as a system
    message).  ``source`` identifies which resource generated this attachment,
    for logging and debugging.
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
