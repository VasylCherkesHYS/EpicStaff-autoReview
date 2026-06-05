"""
AgentResolver: resolves per-agent resource references into a live ToolRegistry
and an AgentContext, returning a ResolvedAgent ready for AgentLoop.run.

Collaborators
-------------
- ``AgentSpec``        — per-agent config + resource refs from the request.
- ``AgentRequest``     — top-level envelope carrying the resource pools.
- ``ToolRegistryBuilder`` — builds the ToolRegistry for this agent.
- ``AgentContext``     — mutable conversation state seeded from AgentSpec.
- ``SandboxClient``    — injected into ToolRegistryBuilder for python-code tools.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from loguru import logger

from app.exceptions import (
    AgentServiceError,
    UnknownRagRefError,
    UnknownS3RefError,
    UnknownToolRefError,
)
from app.loop.context import AgentContext
from app.sandbox.client import SandboxClient
from app.tools.registry import ToolRegistry
from app.tools.registry_builder import ToolRegistryBuilder
from shared.models.agent_service import (
    AgentRequest,
    AgentSpec,
    ContextAttachment,
    RagSpec,
    S3FileSpec,
)
from shared.models.tools import BaseToolData, McpToolData, PythonCodeToolData


@dataclass
class ResolvedAgent:
    """Holds everything needed to run one agent through ``AgentLoop``.

    Not a DTO — contains live objects (``ToolRegistry``) and must not be
    serialised.  ``attachments`` will carry RAG/S3 context once those passes
    are implemented.
    """

    agent_id: int
    context: AgentContext
    tools: ToolRegistry
    attachments: list[ContextAttachment] = field(default_factory=list)


class AgentResolver:
    """Resolves ``AgentSpec`` resource refs against the ``AgentRequest`` pools.

    Construction-time dependency: ``SandboxClient`` (passed to
    ``ToolRegistryBuilder`` for python-code tool execution).

    Resolution steps
    ----------------
    1. Index the request pools by key (``unique_name`` for tools/rags, ``id``
       for s3_files).
    2. For each ``agent.tool_refs``: look up in pool → raise
       ``UnknownToolRefError`` if missing → dispatch by unique_name prefix to
       the appropriate builder method.
    3. For each ``agent.rag_refs`` / ``agent.s3_refs``: validate presence
       (raise on missing) and carry — no executor built yet.
    4. Build ``AgentContext`` from ``AgentSpec``.
    5. Return ``ResolvedAgent``.
    """

    def __init__(self, sandbox: SandboxClient) -> None:
        self._sandbox = sandbox

    def resolve(self, agent: AgentSpec, request: AgentRequest) -> ResolvedAgent:
        """Resolve all refs for ``agent`` against the pools in ``request``."""
        tool_pool: dict[str, BaseToolData] = {
            entry.unique_name: entry for entry in request.tools
        }
        rag_pool: dict[str, RagSpec] = {spec.unique_name: spec for spec in request.rags}
        s3_pool: dict[int, S3FileSpec] = {spec.id: spec for spec in request.s3_files}

        registry = self._build_tool_registry(agent, tool_pool)
        self._validate_rag_refs(agent, rag_pool)
        s3_paths = self._validate_s3_refs(agent, s3_pool)

        if s3_paths:
            logger.info(
                "agent_id={} carrying {} s3 ref(s) (not resolved this pass): {}",
                agent.id,
                len(s3_paths),
                s3_paths,
            )

        rag_carried = [rag_pool[ref] for ref in agent.rag_refs]
        if rag_carried:
            logger.info(
                "agent_id={} carrying {} rag ref(s) (not resolved this pass): {}",
                agent.id,
                len(rag_carried),
                [r.unique_name for r in rag_carried],
            )

        context = AgentContext(
            agent=agent,
            attachments=[],
            correlation_id=request.correlation_id,
        )

        return ResolvedAgent(
            agent_id=agent.id,
            context=context,
            tools=registry,
            attachments=[],
        )

    def _build_tool_registry(
        self,
        agent: AgentSpec,
        tool_pool: dict[str, BaseToolData],
    ) -> ToolRegistry:
        builder = ToolRegistryBuilder(self._sandbox).add_system_tools()

        for ref in agent.tool_refs:
            if ref not in tool_pool:
                raise UnknownToolRefError(
                    f"agent_id={agent.id}: tool_ref '{ref}' not found in request.tools pool"
                )

            entry = tool_pool[ref]
            prefix = ref.split(":")[0]

            if prefix == "python-code-tool":
                assert isinstance(entry.data, PythonCodeToolData)
                builder.add_python_code_tool(entry.data)

            elif prefix == "mcp-tool":
                assert isinstance(entry.data, McpToolData)
                # McpToolData has no name/description/args_schema — use unique_name
                # leaf as name and empty schema until MCP metadata is available.
                tool_name = ref.split(":", 1)[1] if ":" in ref else ref
                builder.add_mcp_tool(
                    entry.data,
                    name=tool_name,
                    description=f"MCP tool {ref}",
                    args_schema={},
                )

            else:
                raise AgentServiceError(
                    f"agent_id={agent.id}: tool prefix '{prefix}' (ref='{ref}') "
                    "is not supported in the agent service yet "
                    "(configured-tool and proxy-tool are crew-only)"
                )

        return builder.build()

    def _validate_rag_refs(
        self,
        agent: AgentSpec,
        rag_pool: dict[str, RagSpec],
    ) -> None:
        for ref in agent.rag_refs:
            if ref not in rag_pool:
                raise UnknownRagRefError(
                    f"agent_id={agent.id}: rag_ref '{ref}' not found in request.rags pool"
                )

    def _validate_s3_refs(
        self,
        agent: AgentSpec,
        s3_pool: dict[int, S3FileSpec],
    ) -> list[str]:
        paths: list[str] = []

        for file_id in agent.s3_refs:
            if file_id not in s3_pool:
                raise UnknownS3RefError(
                    f"agent_id={agent.id}: s3_ref id={file_id} not found in request.s3_files pool"
                )

            paths.append(s3_pool[file_id].path)

        return paths
