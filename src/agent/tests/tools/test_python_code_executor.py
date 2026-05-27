"""
Tests for PythonCodeToolExecutor.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models import ToolResult
from app.tools.descriptors import PythonCodeToolDescriptor
from app.tools.executors.python_code import PythonCodeToolExecutor
from shared.models.tools import CodeResultData


def _make_descriptor(**overrides) -> PythonCodeToolDescriptor:
    defaults = dict(
        name="my_tool",
        description="A test tool.",
        args_schema={"type": "object", "properties": {"x": {"type": "string"}}},
        code="def run(x): return x",
        entrypoint="run",
        libraries=["requests"],
        configuration={"timeout": 30},
        global_kwargs={"env": "test"},
        venv_name="venv_pyt_42",
    )
    defaults.update(overrides)
    return PythonCodeToolDescriptor(**defaults)


def _make_success_result(
    execution_id: str = "exec-1", result_data: str = "output"
) -> CodeResultData:
    return CodeResultData(
        execution_id=execution_id,
        result_data=result_data,
        stderr="",
        stdout="",
        returncode=0,
    )


def _make_error_result(
    execution_id: str = "exec-1", stderr: str = "something went wrong"
) -> CodeResultData:
    return CodeResultData(
        execution_id=execution_id,
        result_data=None,
        stderr=stderr,
        stdout="",
        returncode=1,
    )


async def test_builds_code_task_data_with_correct_fields():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(return_value=_make_success_result())

    descriptor = _make_descriptor()
    executor = PythonCodeToolExecutor(sandbox, descriptor)
    await executor({"x": "hello"})

    sandbox.submit.assert_called_once()
    task = sandbox.submit.call_args[0][0]

    assert task.venv_name == "venv_pyt_42"
    assert task.libraries == ["requests"]
    assert task.code == "def run(x): return x"
    assert task.entrypoint == "run"
    assert task.global_kwargs == {"env": "test"}
    assert task.use_storage is False


async def test_func_kwargs_merges_configuration_with_args():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(return_value=_make_success_result())

    descriptor = _make_descriptor(configuration={"timeout": 30, "mode": "default"})
    executor = PythonCodeToolExecutor(sandbox, descriptor)
    await executor({"mode": "override", "extra": "value"})

    task = sandbox.submit.call_args[0][0]
    assert task.func_kwargs == {"timeout": 30, "mode": "override", "extra": "value"}


async def test_llm_args_override_configuration():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(return_value=_make_success_result())

    descriptor = _make_descriptor(configuration={"key": "config_value"})
    executor = PythonCodeToolExecutor(sandbox, descriptor)
    await executor({"key": "llm_value"})

    task = sandbox.submit.call_args[0][0]
    assert task.func_kwargs["key"] == "llm_value"


async def test_success_returns_tool_result_with_content():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(
        return_value=_make_success_result(result_data="the answer")
    )

    executor = PythonCodeToolExecutor(sandbox, _make_descriptor())
    result = await executor({})

    assert isinstance(result, ToolResult)
    assert result.content == "the answer"
    assert result.is_error is False


async def test_nonzero_returncode_returns_error_with_stderr():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(
        return_value=_make_error_result(stderr="NameError: undefined")
    )

    executor = PythonCodeToolExecutor(sandbox, _make_descriptor())
    result = await executor({})

    assert result.is_error is True
    assert "NameError" in result.content


async def test_nonzero_returncode_with_empty_stderr_uses_stdout():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(
        return_value=CodeResultData(
            execution_id="exec-1",
            result_data=None,
            stderr="",
            stdout="partial output",
            returncode=1,
        )
    )

    executor = PythonCodeToolExecutor(sandbox, _make_descriptor())
    result = await executor({})

    assert result.is_error is True
    assert "partial output" in result.content


async def test_sandbox_raises_returns_transport_error():
    sandbox = MagicMock()
    sandbox.submit = AsyncMock(side_effect=ConnectionError("Redis gone"))

    executor = PythonCodeToolExecutor(sandbox, _make_descriptor())
    result = await executor({})

    assert result.is_error is True
    assert "Sandbox transport error" in result.content
    assert "Redis gone" in result.content


async def test_execution_id_is_generated_by_submit():
    captured_ids: list[str] = []

    async def capturing_submit(task):
        captured_ids.append(task.execution_id)
        return _make_success_result(execution_id=task.execution_id)

    sandbox = MagicMock()
    sandbox.submit = capturing_submit

    executor = PythonCodeToolExecutor(sandbox, _make_descriptor())
    await executor({})
    await executor({})

    assert len(captured_ids) == 2
    assert captured_ids[0] != captured_ids[1]
