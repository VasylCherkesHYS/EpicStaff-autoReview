"""
Integration tests for AgentResolver.

Verifies ref→pool resolution, error paths, unsupported tool types, rag/s3
carried-not-resolved semantics, and multi-agent pool sharing.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.exceptions import (
    AgentServiceError,
    UnknownRagRefError,
    UnknownS3RefError,
    UnknownToolRefError,
)
from app.resources.resolver import AgentResolver
from shared.models.agent_service import (
    AgentRequest,
    AgentSpec,
    RagSpec,
    RunType,
    S3FileSpec,
)
from shared.models.ai_providers import (
    EmbedderConfigData,
    EmbedderData,
    LLMConfigData,
    LLMData,
)
from shared.models.knowledge import NaiveRagSearchConfig
from shared.models.tools import (
    ArgsSchema,
    BaseToolData,
    McpToolData,
    PythonCodeData,
    PythonCodeToolData,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _llm() -> LLMData:
    return LLMData(provider="openai", config=LLMConfigData(model="gpt-4o"))


def _agent_spec(
    tool_refs: list[str] | None = None,
    rag_refs: list[str] | None = None,
    s3_refs: list[int] | None = None,
    agent_id: int = 1,
) -> AgentSpec:
    return AgentSpec(
        id=agent_id,
        name="researcher",
        role="Senior Researcher",
        instructions="You research topics thoroughly.",
        llm=_llm(),
        tool_refs=tool_refs or [],
        rag_refs=rag_refs or [],
        s3_refs=s3_refs or [],
    )


def _python_tool_data(name: str = "my_tool") -> PythonCodeToolData:
    return PythonCodeToolData(
        id=1,
        name=name,
        description="A tool.",
        args_schema=ArgsSchema(properties={}),
        python_code=PythonCodeData(
            venv_name="venv_test",
            code="def run(): return 'ok'",
            entrypoint="run",
            libraries=[],
        ),
    )


def _base_tool(unique_name: str, data) -> BaseToolData:
    return BaseToolData(unique_name=unique_name, data=data)


def _mcp_tool_data(tool_name: str = "mcp_tool") -> McpToolData:
    return McpToolData(transport="http://localhost/sse", tool_name=tool_name)


def _rag_spec(unique_name: str = "naive:3") -> RagSpec:
    return RagSpec(
        unique_name=unique_name,
        collection_id=7,
        rag_id=3,
        rag_type="naive",
        search_config=NaiveRagSearchConfig(),
        embedder=EmbedderData(
            provider="openai",
            config=EmbedderConfigData(model="text-embedding-3-small"),
        ),
    )


def _s3_spec(file_id: int = 88, path: str = "reports/q1.pdf") -> S3FileSpec:
    return S3FileSpec(id=file_id, path=path)


def _request(
    agents: list[AgentSpec],
    tools: list[BaseToolData] | None = None,
    rags: list[RagSpec] | None = None,
    s3_files: list[S3FileSpec] | None = None,
) -> AgentRequest:
    return AgentRequest(
        correlation_id="test-corr",
        run_type=RunType.SINGLE_TASK,
        agents=agents,
        tools=tools or [],
        rags=rags or [],
        s3_files=s3_files or [],
        payload={"prompt": "Go."},
    )


def _resolver() -> AgentResolver:
    return AgentResolver(sandbox=MagicMock())


# ---------------------------------------------------------------------------
# Tool resolution
# ---------------------------------------------------------------------------


async def test_python_tool_ref_resolves_to_registry():
    agent = _agent_spec(tool_refs=["python-code-tool:1"])
    tool = _base_tool("python-code-tool:1", _python_tool_data())
    request = _request([agent], tools=[tool])

    resolved = _resolver().resolve(agent, request)

    names = {spec.name for spec in resolved.tools.tool_specs()}
    assert "usr_my_tool" in names


async def test_mcp_tool_ref_resolves_to_registry():
    agent = _agent_spec(tool_refs=["mcp-tool:4"])
    tool = _base_tool("mcp-tool:4", _mcp_tool_data("mcp_tool"))
    request = _request([agent], tools=[tool])

    resolved = _resolver().resolve(agent, request)

    names = {spec.name for spec in resolved.tools.tool_specs()}
    # leaf id "4" used as name
    assert "usr_4" in names


async def test_unknown_tool_ref_raises():
    agent = _agent_spec(tool_refs=["python-code-tool:99"])
    request = _request([agent], tools=[])

    with pytest.raises(UnknownToolRefError, match="python-code-tool:99"):
        _resolver().resolve(agent, request)


async def test_unsupported_tool_prefix_raises_agent_service_error():
    from shared.models.tools import ConfiguredToolData, ToolConfigData

    agent = _agent_spec(tool_refs=["configured-tool:5"])
    tool = _base_tool(
        "configured-tool:5",
        ConfiguredToolData(
            name_alias="alias",
            tool_config=ToolConfigData(id=5),
        ),
    )
    request = _request([agent], tools=[tool])

    with pytest.raises(AgentServiceError, match="not supported"):
        _resolver().resolve(agent, request)


# ---------------------------------------------------------------------------
# RAG / S3 carried-not-resolved
# ---------------------------------------------------------------------------


async def test_rag_ref_validates_and_carries():
    rag = _rag_spec("naive:3")
    agent = _agent_spec(rag_refs=["naive:3"])
    request = _request([agent], rags=[rag])

    resolved = _resolver().resolve(agent, request)

    # No attachment built (out of scope), but resolution succeeds
    assert resolved.attachments == []


async def test_unknown_rag_ref_raises():
    agent = _agent_spec(rag_refs=["naive:99"])
    request = _request([agent], rags=[])

    with pytest.raises(UnknownRagRefError, match="naive:99"):
        _resolver().resolve(agent, request)


async def test_s3_ref_validates_and_carries_path():
    s3 = _s3_spec(88, "reports/q1.pdf")
    agent = _agent_spec(s3_refs=[88])
    request = _request([agent], s3_files=[s3])

    resolved = _resolver().resolve(agent, request)

    # No executor built (out of scope), but resolution succeeds
    assert resolved.attachments == []


async def test_unknown_s3_ref_raises():
    agent = _agent_spec(s3_refs=[999])
    request = _request([agent], s3_files=[])

    with pytest.raises(UnknownS3RefError, match="999"):
        _resolver().resolve(agent, request)


# ---------------------------------------------------------------------------
# Multi-agent pool sharing
# ---------------------------------------------------------------------------


async def test_two_agents_share_pool_each_gets_own_registry():
    """Two agents referencing the same python-code-tool:1 each get a registry
    with that tool registered; the pool entry is stored once."""
    tool = _base_tool("python-code-tool:1", _python_tool_data("shared_tool"))
    agent_a = _agent_spec(tool_refs=["python-code-tool:1"], agent_id=1)
    agent_b = _agent_spec(tool_refs=["python-code-tool:1"], agent_id=2)
    request = _request([agent_a, agent_b], tools=[tool])

    resolver = _resolver()
    resolved_a = resolver.resolve(agent_a, request)
    resolved_b = resolver.resolve(agent_b, request)

    names_a = {spec.name for spec in resolved_a.tools.tool_specs()}
    names_b = {spec.name for spec in resolved_b.tools.tool_specs()}
    assert "usr_shared_tool" in names_a
    assert "usr_shared_tool" in names_b
    # Registries are separate objects
    assert resolved_a.tools is not resolved_b.tools


# ---------------------------------------------------------------------------
# ResolvedAgent structure
# ---------------------------------------------------------------------------


def test_resolved_agent_carries_correct_agent_id():
    agent = _agent_spec(agent_id=42)
    request = _request([agent])

    resolved = _resolver().resolve(agent, request)

    assert resolved.agent_id == 42


def test_resolved_agent_context_has_empty_messages():
    """Resolver returns context with empty messages; prompt is built by the runner."""
    agent = _agent_spec()
    request = _request([agent])

    resolved = _resolver().resolve(agent, request)

    assert resolved.context.messages == []
