"""
Tests for SingleTaskRunner.

Uses lightweight fakes for Emitter, AgentResolver, and AgentLoop so the
runner's orchestration logic is tested in isolation from I/O.
"""

from __future__ import annotations

import pytest

from app.emitters.base import Emitter
from app.exceptions import AgentServiceError
from app.llm.client import LLMChunk
from app.loop.agent_loop import AgentLoop
from app.loop.context import AgentContext
from app.resources.resolver import AgentResolver, ResolvedAgent
from app.runners.deps import RunnerDependencies
from app.runners.single_task import SingleTaskRunner
from app.tools.registry import ToolRegistry
from shared.models.agent_service import (
    AgentRequest,
    AgentSpec,
    LoopResult,
    RunType,
    ToolResult,
)
from shared.models.ai_providers import LLMConfigData, LLMData


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class FakeEmitter(Emitter):
    def __init__(self) -> None:
        self.started: list = []
        self.finals: list[LoopResult] = []
        self.errors: list[Exception] = []

    async def on_start(self, request) -> None:
        self.started.append(request)

    async def on_chunk(self, chunk: LLMChunk) -> None:
        pass

    async def on_tool_call(self, call: object) -> None:
        pass

    async def on_tool_result(self, result: ToolResult) -> None:
        pass

    async def on_final(self, result: LoopResult) -> None:
        self.finals.append(result)

    async def on_error(self, error: Exception) -> None:
        self.errors.append(error)


CANNED_RESULT = LoopResult(
    final_text="Done.",
    tool_invocations=0,
    iterations=1,
    stop_reason="no_tool_calls",
)


class FakeLoop(AgentLoop):
    """Records context.messages snapshot at call time; returns canned result."""

    def __init__(self) -> None:
        self.received_messages: list[list[dict]] = []

    async def run(self, context, tools, emitter, stop) -> LoopResult:
        self.received_messages.append(list(context.messages))
        return CANNED_RESULT


class FakeResolver:
    """Returns a ResolvedAgent with a real AgentContext and empty ToolRegistry."""

    def resolve(self, agent: AgentSpec, request: AgentRequest) -> ResolvedAgent:
        context = AgentContext(
            agent=agent,
            attachments=[],
            correlation_id=request.correlation_id,
        )
        return ResolvedAgent(
            agent_id=agent.id,
            context=context,
            tools=ToolRegistry(),
            attachments=[],
        )


class RaisingResolver:
    """Raises on resolve to simulate resolver failure."""

    def resolve(self, agent: AgentSpec, request: AgentRequest) -> ResolvedAgent:
        raise RuntimeError("resolver exploded")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _agent_spec() -> AgentSpec:
    return AgentSpec(
        id=12,
        name="researcher",
        role="Senior Researcher",
        instructions="You research topics thoroughly.",
        llm=LLMData(provider="openai", config=LLMConfigData(model="gpt-4o")),
        max_iter=5,
    )


def _request(payload: dict, agents: list[AgentSpec] | None = None) -> AgentRequest:
    return AgentRequest(
        correlation_id="test-corr",
        run_type=RunType.SINGLE_TASK,
        agents=agents if agents is not None else [_agent_spec()],
        payload=payload,
    )


def _runner(resolver=None, loop=None) -> SingleTaskRunner:
    resolver = resolver or FakeResolver()
    loop = loop or FakeLoop()
    deps = RunnerDependencies(resolver=resolver, loop=loop)
    return SingleTaskRunner(deps)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_happy_path_single_agent():
    emitter = FakeEmitter()
    fake_loop = FakeLoop()
    runner = _runner(loop=fake_loop)
    request = _request({"task_instructions": "Do X"})

    await runner.execute(request, emitter)

    assert len(emitter.started) == 1
    assert emitter.finals == [CANNED_RESULT]
    assert emitter.errors == []

    messages = fake_loop.received_messages[0]
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "Senior Researcher" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "Do X"


async def test_payload_uses_prompt_fallback_key():
    """'prompt' key works as fallback when 'task_instructions' is absent."""
    emitter = FakeEmitter()
    fake_loop = FakeLoop()
    runner = _runner(loop=fake_loop)
    request = _request({"prompt": "Summarize."})

    await runner.execute(request, emitter)

    messages = fake_loop.received_messages[0]
    user_message = next(m for m in messages if m["role"] == "user")
    assert user_message["content"] == "Summarize."
    assert emitter.errors == []


async def test_missing_task_instructions_calls_on_error():
    emitter = FakeEmitter()
    runner = _runner()
    request = _request({"output_schema": {"type": "object"}})

    await runner.execute(request, emitter)

    assert len(emitter.errors) == 1
    assert isinstance(emitter.errors[0], AgentServiceError)
    assert emitter.finals == []


async def test_resolver_raises_calls_on_error():
    emitter = FakeEmitter()
    runner = _runner(resolver=RaisingResolver())
    request = _request({"task_instructions": "Do something."})

    await runner.execute(request, emitter)

    assert len(emitter.errors) == 1
    assert isinstance(emitter.errors[0], RuntimeError)
    assert emitter.finals == []


async def test_on_start_called_once_before_loop():
    emitter = FakeEmitter()
    fake_loop = FakeLoop()
    runner = _runner(loop=fake_loop)
    request = _request({"task_instructions": "Check this."})

    await runner.execute(request, emitter)

    assert len(emitter.started) == 1
    assert emitter.started[0] is request
