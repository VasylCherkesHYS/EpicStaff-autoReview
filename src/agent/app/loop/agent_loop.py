"""
Layer 3 — AgentLoop ABC and DefaultAgentLoop: single-agent tool-use cycle.

``AgentLoop`` is the only component in the architecture that speaks to
``LLMClient``, accumulates tool calls across chunks, dispatches to
``ToolRegistry``, and checks ``StopPolicy``.  It is deliberately ignorant of
``RunType``; runners decide *how many* times to invoke it.

``DefaultAgentLoop`` is the canonical concrete implementation: one LLM call
per iteration, streaming always enabled, tool errors fed back as
``ToolResult(is_error=True)`` so the model can recover, wall-clock limit
enforced via ``asyncio.wait_for``.
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.emitters.base import Emitter
from app.llm.client import LLMClient, LLMChunk
from app.loop.context import AgentContext
from app.loop.stop_policy import StopPolicy
from app.models import LoopResult, ToolResult
from app.tools.registry import ToolRegistry


class AgentLoop(ABC):
    """Abstract single-agent tool-use cycle.

    One ``run`` call corresponds to one full LLM conversation turn that may
    span multiple iterations (each iteration: call LLM → process chunks →
    execute tools → repeat until ``StopPolicy`` says stop).

    Collaborators: ``AgentContext`` (mutable conversation state),
    ``ToolRegistry`` (tool dispatch), ``Emitter`` (streaming hooks),
    ``StopPolicy`` (termination condition).
    """

    @abstractmethod
    async def run(
        self,
        context: AgentContext,
        tools: ToolRegistry,
        emitter: Emitter,
        stop: StopPolicy,
    ) -> LoopResult:
        """Execute the tool-use cycle and return a summary result.

        Subclasses must:
        - Build messages from ``context`` (system prompt + attachments + history).
        - Call ``LLMClient.chat`` in a loop, driving ``emitter`` hooks for
          each chunk, tool call, and tool result.
        - Append assistant and tool messages to ``context`` after each iteration.
        - Delegate termination decisions to ``stop.should_stop``.
        - Return a ``LoopResult`` describing the completed cycle.
        """
        ...


@dataclass
class _RunState:
    """Mutable accumulator for in-progress loop statistics.

    Held outside ``_run_inner`` so a timeout can still return whatever
    progress was made before the cancellation point.
    """

    iterations: int = 0
    tool_invocations: int = 0
    final_text: str | None = None


def _classify_stop(
    complete_calls: list,
    stop: StopPolicy,
) -> str:
    """Return the human-readable stop reason for a completed iteration.

    Inspects the concrete policy type to distinguish ``"max_iter_reached"``
    from ``"no_tool_calls"``.  Falls back to ``"stopped"`` for custom policies.
    """
    from app.loop.stop_policy import MaxIterAndNoToolCalls

    if isinstance(stop, MaxIterAndNoToolCalls):
        if not complete_calls:
            return "no_tool_calls"

        return "max_iter_reached"

    return "stopped"


class DefaultAgentLoop(AgentLoop):
    """Canonical single-agent tool-use loop.

    Drives one LLM conversation turn: stream chunks, accumulate tool calls,
    dispatch tools, feed results back, repeat until ``StopPolicy`` says stop.

    Tool errors (raises, JSON parse failures, unknown names) are coalesced into
    ``ToolResult(is_error=True)`` and fed back to the LLM — they never abort
    the loop.  LLM-level exceptions and wall-clock limit exhaustion terminate
    the loop and return a partial ``LoopResult``.
    """

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    async def run(
        self,
        context: AgentContext,
        tools: ToolRegistry,
        emitter: Emitter,
        stop: StopPolicy,
    ) -> LoopResult:
        """Enforce the wall-clock limit and delegate to ``_run_inner``."""
        state = _RunState()
        time_limit = context.agent_config.max_execution_time

        try:
            if time_limit is None:
                return await self._run_inner(context, tools, emitter, stop, state)

            return await asyncio.wait_for(
                self._run_inner(context, tools, emitter, stop, state),
                timeout=time_limit,
            )

        except asyncio.TimeoutError as error:
            await emitter.on_error(error)
            return LoopResult(
                stop_reason="timeout",
                final_text=state.final_text,
                tool_invocations=state.tool_invocations,
                iterations=state.iterations,
            )

        except Exception as error:
            await emitter.on_error(error)
            return LoopResult(
                stop_reason="llm_error",
                final_text=state.final_text,
                tool_invocations=state.tool_invocations,
                iterations=state.iterations,
            )

    async def _run_inner(
        self,
        context: AgentContext,
        tools: ToolRegistry,
        emitter: Emitter,
        stop: StopPolicy,
        state: _RunState,
    ) -> LoopResult:
        """Core iteration loop — no timeout handling, no exception swallowing."""
        while True:
            text_buf = ""
            tool_buf: dict[str, dict] = {}
            chunks: list[LLMChunk] = []

            async for chunk in self._llm.chat(
                messages=context.messages,
                tools=tools.tool_specs(),
                model_config={
                    "model": context.agent_config.model,
                    **context.agent_config.params,
                },
                stream=True,
                runtime_config={
                    "max_retry_limit": context.agent_config.max_retry_limit,
                    "max_rpm": context.agent_config.max_rpm,
                },
            ):
                await emitter.on_chunk(chunk)
                chunks.append(chunk)

                if chunk.delta_text:
                    text_buf += chunk.delta_text

                if chunk.tool_call_fragment:
                    fragment = chunk.tool_call_fragment
                    entry = tool_buf.setdefault(
                        fragment.id, {"name": fragment.name, "args": ""}
                    )
                    entry["args"] += fragment.arguments_delta

            # Only append the assistant message when there is content to record.
            # An iteration with neither text nor tool calls still counts toward
            # the iteration limit; StopPolicy will terminate naturally.
            if text_buf or tool_buf:
                assistant_message: dict = {"role": "assistant"}

                if text_buf:
                    assistant_message["content"] = text_buf
                    state.final_text = text_buf

                if tool_buf:
                    assistant_message["tool_calls"] = [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": entry["name"],
                                "arguments": entry["args"],
                            },
                        }
                        for call_id, entry in tool_buf.items()
                    ]

                context.append_message(assistant_message)

            complete_calls = [
                (call_id, entry["name"], entry["args"])
                for call_id, entry in tool_buf.items()
            ]

            for call_id, name, args_str in complete_calls:
                await emitter.on_tool_call(
                    {"id": call_id, "name": name, "arguments": args_str}
                )
                result = await self._execute_tool(tools, call_id, name, args_str)
                await emitter.on_tool_result(result)
                context.append_message(
                    {"role": "tool", "tool_call_id": call_id, "content": result.content}
                )
                state.tool_invocations += 1

            state.iterations += 1

            if stop.should_stop(state.iterations, chunks, complete_calls):
                stop_reason = _classify_stop(complete_calls, stop)
                return LoopResult(
                    final_text=state.final_text,
                    tool_invocations=state.tool_invocations,
                    iterations=state.iterations,
                    stop_reason=stop_reason,
                )

    async def _execute_tool(
        self,
        tools: ToolRegistry,
        call_id: str,
        name: str,
        args_str: str,
    ) -> ToolResult:
        """Coalesce all tool-execution failure modes into ``ToolResult(is_error=True)``."""
        try:
            args = json.loads(args_str) if args_str else {}

        except json.JSONDecodeError as error:
            return ToolResult(
                tool_call_id=call_id,
                content=f"Invalid JSON arguments: {error}",
                is_error=True,
            )

        try:
            result = await tools.execute(name, args)

            if result.tool_call_id != call_id:
                result = result.model_copy(update={"tool_call_id": call_id})

            return result

        except KeyError:
            return ToolResult(
                tool_call_id=call_id, content=f"Unknown tool: {name}", is_error=True
            )

        except Exception as error:
            return ToolResult(
                tool_call_id=call_id,
                content=f"Tool '{name}' raised: {error}",
                is_error=True,
            )
