from __future__ import annotations

from dataclasses import dataclass, field

from django.core.exceptions import ValidationError
from django.db import models

from tables.models.base_models import TimestampMixin


@dataclass
class ResolvedSurface:
    additional_instructions: str
    tool_configs: list = field(default_factory=list)
    python_code_tool_configs: list = field(default_factory=list)
    mcp_tools: list = field(default_factory=list)
    knowledge_collections: list = field(default_factory=list)
    storage_files: list = field(default_factory=list)


class Surface(TimestampMixin, models.Model):
    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="surfaces",
        help_text="Organization this surface belongs to.",
    )
    name = models.CharField(
        max_length=255,
        help_text="Stable identifier unique within the organization. Used as the user-facing name for this surface.",
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Optional human-readable description shown in the UI. Empty string means no description.",
    )
    additional_instructions = models.TextField(
        blank=True,
        default="",
        help_text="Free-form text appended to the agent prompt when this surface is resolved. Empty string means no extra instructions.",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        help_text="Optional parent surface. Effective resources are the union of this surface and its full parent chain (root first). Null means no parent.",
    )
    allowed_agents = models.ManyToManyField(
        "AgentDefinition",
        blank=True,
        related_name="allowed_surfaces",
        help_text="AgentDefinition instances permitted to select this surface. Empty set means any agent in the organization may use it.",
    )
    tool_configs = models.ManyToManyField(
        "ToolConfig",
        blank=True,
        related_name="surfaces",
        help_text="Standard ToolConfig instances (configured tool invocations) exposed by this surface.",
    )
    python_code_tool_configs = models.ManyToManyField(
        "PythonCodeToolConfig",
        blank=True,
        related_name="surfaces",
        help_text="PythonCodeToolConfig instances exposed by this surface.",
    )
    mcp_tools = models.ManyToManyField(
        "McpTool",
        blank=True,
        related_name="surfaces",
        help_text="MCP tool instances exposed by this surface. Auth and URL are stored on McpTool directly.",
    )
    knowledge_collections = models.ManyToManyField(
        "SourceCollection",
        blank=True,
        related_name="surfaces",
        help_text="RAG SourceCollection instances this surface grants access to.",
    )
    storage_files = models.ManyToManyField(
        "StorageFile",
        through="SurfaceStorageFile",
        blank=True,
        related_name="surfaces",
        help_text="Object-storage files this surface grants access to. Linked via SurfaceStorageFile through-table.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_surface_name_per_organization",
            )
        ]

    def clean(self) -> None:
        if not self.pk or self.parent_id is None:
            return

        visited: set[int] = set()
        current: Surface | None = self.parent

        while current is not None:
            if current.pk == self.pk:
                raise ValidationError("Surface parent chain contains a cycle.")

            if current.pk in visited:
                break

            visited.add(current.pk)
            current = current.parent

    def __repr__(self) -> str:
        return f"Surface(id={self.pk}, name={self.name!r})"

    def resolve(self) -> ResolvedSurface:
        """
        Walk parent chain root→leaf, union resources, concatenate
        additional_instructions in chain order.
        """
        chain: list[Surface] = []
        current: Surface | None = self

        while current is not None:
            chain.append(current)
            current = current.parent

        chain.reverse()

        instructions_parts = [
            s.additional_instructions for s in chain if s.additional_instructions
        ]

        def _union_by_pk(queryset_iter):
            seen: dict[int, object] = {}

            for obj in queryset_iter:
                if obj.pk not in seen:
                    seen[obj.pk] = obj

            return list(seen.values())

        return ResolvedSurface(
            additional_instructions="\n\n".join(instructions_parts),
            tool_configs=_union_by_pk(
                obj for s in chain for obj in s.tool_configs.all()
            ),
            python_code_tool_configs=_union_by_pk(
                obj for s in chain for obj in s.python_code_tool_configs.all()
            ),
            mcp_tools=_union_by_pk(obj for s in chain for obj in s.mcp_tools.all()),
            knowledge_collections=_union_by_pk(
                obj for s in chain for obj in s.knowledge_collections.all()
            ),
            storage_files=_union_by_pk(
                obj for s in chain for obj in s.storage_files.all()
            ),
        )

    def is_available_to(self, agent_definition) -> bool:
        if not self.allowed_agents.exists():
            return True

        return self.allowed_agents.filter(pk=agent_definition.pk).exists()


class SurfaceStorageFile(models.Model):
    surface = models.ForeignKey(
        Surface,
        on_delete=models.CASCADE,
        help_text="Surface this file attachment belongs to.",
    )
    storage_file = models.ForeignKey(
        "StorageFile",
        on_delete=models.CASCADE,
        help_text="Object-storage file granted by this surface.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this file was attached to the surface.",
    )

    class Meta:
        unique_together = ("surface", "storage_file")
