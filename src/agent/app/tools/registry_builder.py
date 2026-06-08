from __future__ import annotations

import re
from typing import Self

from shared.models.tools import McpToolData, PythonCodeToolData

from app.exceptions import DuplicateToolNameError
from app.sandbox.client import SandboxClient
from app.tools.executors.python_code import PythonCodeToolExecutor
from app.tools.executors.stubs import mcp_tool_executor
from app.tools.registry import ToolRegistry, ToolSpec
from app.tools.system_registry import SystemToolRegistry, get_system_registry

_INVALID_TOOL_NAME_CHARS = re.compile(r"[^A-Za-z0-9_-]")


def sanitize_tool_name(name: str) -> str:
    """Coerce a tool name to the LLM function-name pattern ^[A-Za-z0-9_-]{1,64}$."""
    cleaned = _INVALID_TOOL_NAME_CHARS.sub("_", name).strip("_")[:64]
    return cleaned or "tool"


class ToolRegistryBuilder:
    """Fluent builder that assembles a ``ToolRegistry`` for one agent run.

    Tool names are sanitized to the LLM-valid pattern ``^[A-Za-z0-9_-]{1,64}$``
    before being registered or exposed to the model.  Names must be unique across
    system and user tools; duplicates (including two names that collide after
    sanitisation) raise ``DuplicateToolNameError``.

    Method signatures
    -----------------
    ``add_python_code_tool(data: PythonCodeToolData)``
        Name, description, and args_schema are taken from ``data`` directly.

    ``add_mcp_tool(data: McpToolData, *, name: str, description: str, args_schema: dict)``
        ``McpToolData`` carries only transport/auth config; name, description,
        and args_schema must be supplied by the caller (``AgentResolver``
        derives them from the tool pool entry metadata).
    """

    def __init__(self, sandbox: SandboxClient) -> None:
        self._sandbox = sandbox
        self._registry = ToolRegistry()
        self._names: set[str] = set()
        self._built = False

    def _check_built(self) -> None:
        if self._built:
            raise RuntimeError("ToolRegistryBuilder is single-use")

    def _add_name(self, name: str) -> None:
        if name in self._names:
            raise DuplicateToolNameError(f"Tool name '{name}' is already registered")
        self._names.add(name)

    def add_system_tools(self, registry: SystemToolRegistry | None = None) -> Self:
        self._check_built()
        source = registry if registry is not None else get_system_registry()

        for entry in source.entries():
            clean_name = sanitize_tool_name(entry.name)
            self._add_name(clean_name)
            spec = ToolSpec(
                name=clean_name,
                description=entry.description,
                parameters_schema=entry.parameters_schema,
            )
            self._registry.register(spec, entry.executor)

        return self

    def add_python_code_tool(self, data: PythonCodeToolData) -> Self:
        """Register a python-code tool. Name, description, and schema come from ``data``."""
        self._check_built()
        clean_name = sanitize_tool_name(data.name)
        self._add_name(clean_name)
        spec = ToolSpec(
            name=clean_name,
            description=data.description,
            parameters_schema=data.args_schema.model_dump(),
        )
        executor = PythonCodeToolExecutor(self._sandbox, data)
        self._registry.register(spec, executor)
        return self

    def add_mcp_tool(
        self,
        data: McpToolData,
        *,
        name: str,
        description: str,
        args_schema: dict,
    ) -> Self:
        """Register an MCP tool.

        ``McpToolData`` carries transport/auth config only; ``name``,
        ``description``, and ``args_schema`` must be supplied by the caller.
        """
        self._check_built()
        clean_name = sanitize_tool_name(name)
        self._add_name(clean_name)
        spec = ToolSpec(
            name=clean_name,
            description=description,
            parameters_schema=args_schema,
        )
        executor = mcp_tool_executor(data, name)
        self._registry.register(spec, executor)
        return self

    def build(self) -> ToolRegistry:
        self._check_built()
        self._built = True
        return self._registry
