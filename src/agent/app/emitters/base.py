"""
Layer 1 — Emitter ABC: transport-agnostic output sink (Bridge pattern).

The Emitter is the Bridge between the agent execution layers (Runner,
AgentLoop) and the output transport (Redis Streams, WebSocket, etc.).
Concrete implementations differ in *when* they publish and *what* they
include.  ``RunnerFactory`` selects the implementation; neither Runner nor
AgentLoop knows which one is active.

Hooks mirror the lifecycle of a single ``AgentLoop`` execution:
``on_start`` → (``on_chunk`` / ``on_tool_call`` / ``on_tool_result``) * N
→ ``on_final`` | ``on_error``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.llm.client import LLMChunk
from app.models import AgentRequest, LoopResult, ToolResult


class Emitter(ABC):
    """Abstract output transport for agent execution events.

    Subclasses must implement all six lifecycle hooks.  Implementations may
    buffer events internally (``RedisStreamBatchEmitter``) or publish each
    event immediately (future ``RedisStreamDeltaEmitter``).

    ``RequestHandler`` holds a reference to the emitter and also constructs
    a fallback ``RedisStreamBatchEmitter`` directly when the factory itself
    fails, so ``on_error`` must be safe to call before ``on_start``.
    """

    @abstractmethod
    async def on_start(self, request: AgentRequest) -> None:
        """Called once before the runner begins execution.

        Subclasses may use this to record the start timestamp, initialise
        buffers, or publish a ``started`` status envelope.
        """
        ...

    @abstractmethod
    async def on_chunk(self, chunk: LLMChunk) -> None:
        """Called for each ``LLMChunk`` produced by ``LLMClient.chat``.

        Batch implementations buffer the chunk; streaming implementations
        publish it immediately.
        """
        ...

    @abstractmethod
    async def on_tool_call(self, call: object) -> None:
        """Called when the loop dispatches a tool call to ``ToolRegistry``.

        ``call`` is the assembled tool-call object (type TBD by follow-up
        plan; typed as ``object`` for now).
        """
        ...

    @abstractmethod
    async def on_tool_result(self, result: ToolResult) -> None:
        """Called after ``ToolRegistry.execute`` returns a ``ToolResult``."""
        ...

    @abstractmethod
    async def on_final(self, result: LoopResult) -> None:
        """Called once when the loop finishes successfully.

        Subclasses must publish the accumulated result to the output
        transport here.  For ``RedisStreamBatchEmitter`` this is the point
        where the single ``agent.result`` envelope is written to the stream.
        """
        ...

    @abstractmethod
    async def on_error(self, error: Exception) -> None:
        """Called when an unrecoverable error occurs at any pipeline stage.

        Must publish an ``agent.error`` envelope so downstream consumers
        are not left waiting.  Must not raise.
        """
        ...
