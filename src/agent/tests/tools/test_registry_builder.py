"""
Tests for ToolRegistryBuilder.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.exceptions import AgentServiceError, DuplicateToolNameError
from app.tools.mcp.gateway import McpToolGateway
from app.tools.registry_builder import ToolRegistryBuilder
from app.tools.system_registry import (
    SystemToolRegistry,
    get_system_registry,
    system_tool,
)
from shared.models.agent_service import ToolResult
from shared.models.tools import (
    ArgsSchema,
    McpToolData,
    PythonCodeData,
    PythonCodeToolData,
)


@pytest.fixture(autouse=True)
def clear_global_registry():
    get_system_registry().clear()
    yield
    get_system_registry().clear()


def _fake_sandbox() -> MagicMock:
    return MagicMock()


def _fake_gateway(return_value: str = "ok") -> McpToolGateway:
    gateway = MagicMock(spec=McpToolGateway)
    gateway.call = AsyncMock(return_value=return_value)
    return gateway


def _python_tool_data(name: str = "my_tool") -> PythonCodeToolData:
    return PythonCodeToolData(
        id=1,
        name=name,
        description="A tool.",
        args_schema=ArgsSchema(properties={}),
        python_code=PythonCodeData(
            venv_name=f"venv_pyt_{name}",
            code="def run(): return 'ok'",
            entrypoint="run",
            libraries=[],
        ),
    )


def _mcp_tool_data(tool_name: str = "mcp_tool") -> McpToolData:
    return McpToolData(
        transport="http://localhost:8080/sse",
        tool_name=tool_name,
    )


def _register_system_tool(name: str) -> None:
    @system_tool(name=name, description=f"System tool {name}.", parameters_schema={})
    async def tool_func(args: dict) -> str:
        return name


async def test_system_tool_uses_clean_name():
    _register_system_tool("calculator")

    builder = ToolRegistryBuilder(_fake_sandbox())
    registry = builder.add_system_tools().build()

    names = [spec.name for spec in registry.tool_specs()]
    assert "calculator" in names


async def test_python_code_tool_uses_clean_name():
    builder = ToolRegistryBuilder(_fake_sandbox())
    registry = builder.add_python_code_tool(_python_tool_data("formatter")).build()

    names = [spec.name for spec in registry.tool_specs()]
    assert "formatter" in names


async def test_mcp_tool_uses_clean_name():
    builder = ToolRegistryBuilder(_fake_sandbox(), _fake_gateway())
    registry = builder.add_mcp_tool(
        _mcp_tool_data("connector"),
        name="connector",
        description="An MCP tool.",
        args_schema={"type": "object", "properties": {}},
    ).build()

    names = [spec.name for spec in registry.tool_specs()]
    assert "connector" in names


async def test_sys_and_usr_same_name_now_collides():
    _register_system_tool("shared_name")

    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.add_system_tools()

    with pytest.raises(DuplicateToolNameError):
        builder.add_python_code_tool(_python_tool_data("shared_name"))


async def test_duplicate_usr_name_raises_duplicate_tool_name_error():
    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.add_python_code_tool(_python_tool_data("dup"))

    with pytest.raises(DuplicateToolNameError):
        builder.add_python_code_tool(_python_tool_data("dup"))


async def test_duplicate_sys_name_raises_duplicate_tool_name_error():
    from app.tools.system_registry import SystemToolEntry

    async def noop_executor(args: dict) -> ToolResult:
        return ToolResult(tool_call_id="", content="", is_error=False)

    registry_a = SystemToolRegistry()
    registry_a.register(
        SystemToolEntry(
            name="conflict",
            description="First.",
            parameters_schema={},
            executor=noop_executor,
        )
    )

    registry_b = SystemToolRegistry()
    registry_b.register(
        SystemToolEntry(
            name="conflict",
            description="Duplicate.",
            parameters_schema={},
            executor=noop_executor,
        )
    )

    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.add_system_tools(registry_a)

    with pytest.raises(DuplicateToolNameError):
        builder.add_system_tools(registry_b)


async def test_build_is_single_use():
    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.build()

    with pytest.raises(RuntimeError, match="single-use"):
        builder.build()


async def test_build_blocks_further_add_after_build():
    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.build()

    with pytest.raises(RuntimeError, match="single-use"):
        builder.add_python_code_tool(_python_tool_data("after_build"))


async def test_mcp_executor_calls_gateway_and_returns_result():
    gateway = _fake_gateway(return_value="tool output")
    builder = ToolRegistryBuilder(_fake_sandbox(), gateway)
    registry = builder.add_mcp_tool(
        _mcp_tool_data("my_mcp"),
        name="my_mcp",
        description="An MCP tool.",
        args_schema={},
    ).build()

    result = await registry.execute("my_mcp", {})

    assert result.is_error is False
    assert result.content == "tool output"


async def test_add_mcp_tool_without_gateway_raises_agent_service_error():
    builder = ToolRegistryBuilder(_fake_sandbox(), mcp_gateway=None)

    with pytest.raises(AgentServiceError, match="McpToolGateway"):
        builder.add_mcp_tool(
            _mcp_tool_data("my_mcp"),
            name="my_mcp",
            description="An MCP tool.",
            args_schema={},
        )


async def test_system_tool_executor_callable_via_registry():
    _register_system_tool("ping")

    builder = ToolRegistryBuilder(_fake_sandbox())
    registry = builder.add_system_tools().build()

    result = await registry.execute("ping", {})
    assert isinstance(result, ToolResult)
    assert result.is_error is False


async def test_tool_specs_returns_all_registered():
    _register_system_tool("spec_tool")

    builder = ToolRegistryBuilder(_fake_sandbox(), _fake_gateway())
    registry = (
        builder.add_system_tools()
        .add_python_code_tool(_python_tool_data("code_tool"))
        .add_mcp_tool(
            _mcp_tool_data("mcp_tool"),
            name="mcp_tool",
            description="MCP.",
            args_schema={},
        )
        .build()
    )

    specs = registry.tool_specs()
    names = {s.name for s in specs}
    assert names == {"spec_tool", "code_tool", "mcp_tool"}


async def test_tool_name_is_sanitized():
    builder = ToolRegistryBuilder(_fake_sandbox())
    registry = builder.add_python_code_tool(_python_tool_data("My Tool")).build()

    names = [spec.name for spec in registry.tool_specs()]
    assert "My_Tool" in names

    # Sandbox is a MagicMock; executor catches the non-awaitable and returns
    # an error ToolResult — confirms dispatch reaches the executor without
    # raising a registry KeyError on the sanitized name.
    result = await registry.execute("My_Tool", {})
    assert isinstance(result, ToolResult)


async def test_sanitized_collision_raises():
    # "My Tool" and "My_Tool" both sanitize to "My_Tool"
    builder = ToolRegistryBuilder(_fake_sandbox())
    builder.add_python_code_tool(_python_tool_data("My Tool"))

    with pytest.raises(DuplicateToolNameError):
        builder.add_python_code_tool(_python_tool_data("My_Tool"))
