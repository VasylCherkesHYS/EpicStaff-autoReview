"""
Layer 3 — AgentLoop ABC: single-agent tool-use cycle contract.

``AgentLoop`` is the only component in the architecture that speaks to
``LLMClient``, accumulates tool calls across chunks, dispatches to
``ToolRegistry``, and checks ``StopPolicy``.  It is deliberately ignorant of
``RunType``; runners decide *how many* times to invoke it.

The concrete implementation (LiteLLM-backed message building, chunk
accumulation, tool-call dispatch, stop checks) is a follow-up plan.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.emitters.base import Emitter
from app.loop.context import AgentContext
from app.loop.stop_policy import StopPolicy
from app.models import LoopResult
from app.tools.registry import ToolRegistry


class AgentLoop(ABC):
    """Abstract single-agent tool-use cycle.

    One ``run`` call corresponds to one full LLM conversation turn that may
    span multiple iterations (each iteration: call LLM → process chunks →
    execute tools → repeat until ``StopPolicy`` says stop).

    Collaborators: ``AgentContext`` (mutable conversation state),
    ``ToolRegistry`` (tool dispatch), ``Emitter`` (streaming hooks),
    ``StopPolicy`` (termination condition).

    Body to be implemented in follow-up plan — see plan §'What is NOT in this plan'.
    """

    @abstractmethod
    async def run(
        self,
        ctx: AgentContext,
        tools: ToolRegistry,
        emitter: Emitter,
        stop: StopPolicy,
    ) -> LoopResult:
        """Execute the tool-use cycle and return a summary result.

        Subclasses must:
        - Build messages from ``ctx`` (system prompt + attachments + history).
        - Call ``LLMClient.chat`` in a loop, driving ``emitter`` hooks for
          each chunk, tool call, and tool result.
        - Append assistant and tool messages to ``ctx`` after each iteration.
        - Delegate termination decisions to ``stop.should_stop``.
        - Return a ``LoopResult`` describing the completed cycle.

        Body to be implemented in follow-up plan — see plan §'What is NOT in this plan'.
        """
        ...
