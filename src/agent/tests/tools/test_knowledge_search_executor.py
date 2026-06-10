"""
Tests for KnowledgeSearchExecutor and GraphKnowledgeSearchExecutor.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.knowledge.target import KnowledgeSearchTarget
from app.tools.executors.knowledge_search import (
    GRAPH_RAG_SEARCH_TIMEOUT,
    NAIVE_RAG_SEARCH_TIMEOUT,
    GraphKnowledgeSearchExecutor,
    KnowledgeSearchExecutor,
)
from shared.models.agent_service import ToolResult
from shared.models.knowledge import (
    BaseKnowledgeSearchMessageResponse,
    GraphRagBasicSearchParams,
    GraphRagLocalSearchParams,
    GraphRagSearchConfig,
    KnowledgeChunkResponse,
    NaiveRagSearchConfig,
)


def _make_target(rag_type: str = "naive") -> KnowledgeSearchTarget:
    if rag_type == "graph":
        search_config = GraphRagSearchConfig(search_params=GraphRagBasicSearchParams())
    else:
        search_config = NaiveRagSearchConfig()

    return KnowledgeSearchTarget(
        collection_id=10,
        rag_id=1,
        rag_type=rag_type,
        search_config=search_config,
    )


def _make_graph_targets() -> dict[str, KnowledgeSearchTarget]:
    basic = KnowledgeSearchTarget(
        collection_id=10,
        rag_id=2,
        rag_type="graph",
        search_config=GraphRagSearchConfig(search_params=GraphRagBasicSearchParams()),
    )
    local = KnowledgeSearchTarget(
        collection_id=10,
        rag_id=2,
        rag_type="graph",
        search_config=GraphRagSearchConfig(search_params=GraphRagLocalSearchParams()),
    )
    return {"basic": basic, "local": local}


def _make_response(
    chunks: list[KnowledgeChunkResponse],
) -> BaseKnowledgeSearchMessageResponse:
    return BaseKnowledgeSearchMessageResponse(
        rag_id=1,
        rag_type="naive",
        collection_id=10,
        uuid="test-uuid",
        retrieved_chunks=len(chunks),
        query="test query",
        chunks=chunks,
        rag_search_config=NaiveRagSearchConfig(),
    )


def _fake_client(
    response: BaseKnowledgeSearchMessageResponse | None = None,
    raises: Exception | None = None,
) -> MagicMock:
    client = MagicMock()

    if raises is not None:
        client.search = AsyncMock(side_effect=raises)
    else:
        client.search = AsyncMock(return_value=response)

    return client


async def test_chunks_formatted_correctly():
    chunks = [
        KnowledgeChunkResponse(
            chunk_order=0,
            chunk_similarity=0.95,
            chunk_text="Python is a programming language.",
            chunk_source="intro.pdf",
        ),
        KnowledgeChunkResponse(
            chunk_order=1,
            chunk_similarity=0.80,
            chunk_text="It was created by Guido van Rossum.",
            chunk_source="history.pdf",
        ),
    ]
    client = _fake_client(_make_response(chunks))
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({"query": "Python history"})

    assert result.is_error is False
    assert "Python is a programming language." in result.content
    assert "source=intro.pdf" in result.content
    assert "score=0.95" in result.content
    assert "It was created by Guido van Rossum." in result.content
    assert "source=history.pdf" in result.content


async def test_empty_chunks_returns_no_results_message():
    client = _fake_client(_make_response([]))
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({"query": "something obscure"})

    assert result.is_error is False
    assert result.content == "No relevant results found."


async def test_missing_query_returns_error():
    client = _fake_client(_make_response([]))
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({})

    assert result.is_error is True
    assert "query" in result.content


async def test_empty_string_query_returns_error():
    client = _fake_client(_make_response([]))
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({"query": ""})

    assert result.is_error is True
    assert "query" in result.content


async def test_client_raises_returns_error():
    client = _fake_client(raises=RuntimeError("connection refused"))
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({"query": "test"})

    assert result.is_error is True
    assert "Knowledge search failed" in result.content
    assert "connection refused" in result.content


async def test_timeout_returns_error():
    client = _fake_client(raises=asyncio.TimeoutError())
    executor = KnowledgeSearchExecutor(client, _make_target())

    result = await executor({"query": "test"})

    assert result.is_error is True
    assert "Knowledge search failed" in result.content


async def test_graph_rag_uses_longer_timeout():
    """Verify executor passes the correct timeout to client.search for graph RAG."""
    client = _fake_client(_make_response([]))
    target = _make_target(rag_type="graph")
    executor = KnowledgeSearchExecutor(client, target)

    await executor({"query": "test"})

    _, kwargs = client.search.call_args
    assert kwargs["timeout"] == GRAPH_RAG_SEARCH_TIMEOUT


async def test_naive_rag_uses_shorter_timeout():
    """Verify executor passes the correct timeout to client.search for naive RAG."""
    client = _fake_client(_make_response([]))
    target = _make_target(rag_type="naive")
    executor = KnowledgeSearchExecutor(client, target)

    await executor({"query": "test"})

    _, kwargs = client.search.call_args
    assert kwargs["timeout"] == NAIVE_RAG_SEARCH_TIMEOUT


# ---------------------------------------------------------------------------
# GraphKnowledgeSearchExecutor
# ---------------------------------------------------------------------------


async def test_graph_executor_dispatches_local_method():
    """search_method='local' → local target's search_config sent to client."""
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    await executor({"query": "find entity", "search_method": "local"})

    call_args = client.search.call_args
    used_target = call_args[0][0]
    assert used_target is targets["local"]


async def test_graph_executor_dispatches_basic_method():
    """search_method='basic' → basic target sent."""
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    await executor({"query": "summarize", "search_method": "basic"})

    call_args = client.search.call_args
    used_target = call_args[0][0]
    assert used_target is targets["basic"]


async def test_graph_executor_missing_method_defaults_to_basic():
    """No search_method in args → falls back to default ('basic')."""
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    await executor({"query": "question"})

    call_args = client.search.call_args
    used_target = call_args[0][0]
    assert used_target is targets["basic"]


async def test_graph_executor_invalid_method_defaults_to_basic():
    """Unknown search_method → falls back to default."""
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    await executor({"query": "question", "search_method": "nonexistent"})

    call_args = client.search.call_args
    used_target = call_args[0][0]
    assert used_target is targets["basic"]


async def test_graph_executor_only_local_target_defaults_to_local():
    """Only local target present, default='local' → always uses local."""
    targets = {"local": _make_graph_targets()["local"]}
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="local")

    await executor({"query": "question"})

    call_args = client.search.call_args
    used_target = call_args[0][0]
    assert used_target is targets["local"]


async def test_graph_executor_uses_graph_timeout():
    """Graph executor uses GRAPH_RAG_SEARCH_TIMEOUT regardless of method."""
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    await executor({"query": "test", "search_method": "local"})

    _, kwargs = client.search.call_args
    assert kwargs["timeout"] == GRAPH_RAG_SEARCH_TIMEOUT


async def test_graph_executor_missing_query_returns_error():
    targets = _make_graph_targets()
    client = _fake_client(_make_response([]))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    result = await executor({"search_method": "basic"})

    assert result.is_error is True
    assert "query" in result.content


async def test_graph_executor_client_raises_returns_error():
    targets = _make_graph_targets()
    client = _fake_client(raises=RuntimeError("graph down"))
    executor = GraphKnowledgeSearchExecutor(client, targets, default_method="basic")

    result = await executor({"query": "test"})

    assert result.is_error is True
    assert "Knowledge search failed" in result.content
    assert "graph down" in result.content
