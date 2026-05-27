from __future__ import annotations

from typing import Awaitable, Callable

from app.models import ToolResult
from app.tools.descriptors import McpToolDescriptor


def mcp_tool_executor(
    descriptor: McpToolDescriptor,
) -> Callable[[dict], Awaitable[ToolResult]]:
    async def executor(args: dict) -> ToolResult:
        del args
        raise NotImplementedError(
            f"MCP tool execution is not implemented yet — descriptor.name={descriptor.name}. See follow-up plan."
        )

    return executor
