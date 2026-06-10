from __future__ import annotations

import json
from dataclasses import dataclass

from shared.models.tools import McpToolData

from app.exceptions import McpToolError
from app.tools.mcp.client_factory import FastMCPClientFactory


@dataclass
class McpToolDescription:
    description: str
    input_schema: dict


class McpToolGateway:
    """Information Expert for MCP server I/O.

    Holds the factory and exposes two async operations — describe and call —
    that map directly to list_tools / call_tool on the MCP server.  Neither
    method knows about ToolResult; that adaptation lives in McpToolExecutor.
    """

    def __init__(self, factory: FastMCPClientFactory) -> None:
        self._factory = factory

    async def describe(self, data: McpToolData) -> McpToolDescription:
        """Fetch tool metadata from the MCP server.

        Raises McpToolError if the server is unreachable or the tool is absent.
        """
        client = self._factory.create(data)

        try:
            async with client:
                tools = await client.list_tools()

        except Exception as error:
            raise McpToolError(
                f"MCP server unreachable for tool_name={data.tool_name}: {error}"
            ) from error

        tool = next((t for t in tools if t.name == data.tool_name), None)

        if tool is None:
            raise McpToolError(
                f"Tool '{data.tool_name}' not found on MCP server at {data.transport!r}"
            )

        return McpToolDescription(
            description=tool.description or data.tool_name,
            input_schema=dict(tool.inputSchema) if tool.inputSchema else {},
        )

    async def call(self, data: McpToolData, args: dict) -> str:
        """Invoke the MCP tool and return its output as a string.

        Raises McpToolError on tool-reported errors or connection failures.
        """
        client = self._factory.create(data)

        try:
            async with client:
                result = await client.call_tool(data.tool_name, arguments=args)

        except Exception as error:
            raise McpToolError(
                f"MCP call failed for tool_name={data.tool_name}: {error}"
            ) from error

        if result.is_error:
            raise McpToolError(str(result.data))

        if result.structured_content:
            return json.dumps(result.structured_content)

        if result.content:
            return " ".join(c.text for c in result.content if hasattr(c, "text"))

        return str(result.data)
