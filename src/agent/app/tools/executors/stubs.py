from __future__ import annotations

from typing import Awaitable, Callable

from shared.models.agent_service import ToolResult
from shared.models.tools import McpToolData


def mcp_tool_executor(
    data: McpToolData,
    name: str,
) -> Callable[[dict], Awaitable[ToolResult]]:
    async def executor(args: dict) -> ToolResult:
        del args
        raise NotImplementedError(
            f"MCP tool execution is not implemented yet — tool_name={data.tool_name}, name={name}. See follow-up plan."
        )

    return executor
