from __future__ import annotations

from dataclasses import dataclass, field

from django.db import models

from tables.models.base_models import TimestampMixin


@dataclass
class ResolvedSurface:
    additional_instructions: str
    python_code_tool_configs: list = field(default_factory=list)
    mcp_tools: list = field(default_factory=list)
    knowledge_collections: list = field(default_factory=list)
    storage_files: list = field(default_factory=list)


def _minus(allowed_qs, disabled_qs):
    disabled_pks = {o.pk for o in disabled_qs}
    return [o for o in allowed_qs if o.pk not in disabled_pks]


class BaseSurface(TimestampMixin, models.Model):
    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        help_text="Organization this surface belongs to.",
    )
    allowed_python_tools = models.ManyToManyField(
        "PythonCodeToolConfig",
        blank=True,
        related_name="+",
        help_text="PythonCodeToolConfig instances explicitly allowed by this surface.",
    )
    disabled_python_tools = models.ManyToManyField(
        "PythonCodeToolConfig",
        blank=True,
        related_name="+",
        help_text="PythonCodeToolConfig instances explicitly denied by this surface. Deny wins over any allow.",
    )
    allowed_mcp_tools = models.ManyToManyField(
        "McpTool",
        blank=True,
        related_name="+",
        help_text="McpTool instances explicitly allowed by this surface.",
    )
    disabled_mcp_tools = models.ManyToManyField(
        "McpTool",
        blank=True,
        related_name="+",
        help_text="McpTool instances explicitly denied by this surface. Deny wins over any allow.",
    )
    allowed_knowledge_collections = models.ManyToManyField(
        "SourceCollection",
        blank=True,
        related_name="+",
        help_text="SourceCollection instances explicitly allowed by this surface.",
    )
    disabled_knowledge_collections = models.ManyToManyField(
        "SourceCollection",
        blank=True,
        related_name="+",
        help_text="SourceCollection instances explicitly denied by this surface. Deny wins over any allow.",
    )
    allowed_storage_files = models.ManyToManyField(
        "StorageFile",
        blank=True,
        related_name="+",
        help_text="StorageFile instances explicitly allowed by this surface.",
    )
    disabled_storage_files = models.ManyToManyField(
        "StorageFile",
        blank=True,
        related_name="+",
        help_text="StorageFile instances explicitly denied by this surface. Deny wins over any allow.",
    )

    class Meta(TimestampMixin.Meta):
        abstract = True


class Surface(BaseSurface):
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
    allowed_agents = models.ManyToManyField(
        "AgentDefinition",
        blank=True,
        related_name="allowed_surfaces",
        help_text="AgentDefinition instances permitted to select this surface. Empty set means any agent in the organization may use it.",
    )

    class Meta(BaseSurface.Meta):
        abstract = False
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="uniq_surface_org_name",
            ),
        ]

    def __repr__(self) -> str:
        return f"Surface(id={self.pk}, name={self.name!r})"

    def resolve(self) -> ResolvedSurface:
        return ResolvedSurface(
            additional_instructions=self.additional_instructions,
            python_code_tool_configs=_minus(
                self.allowed_python_tools.all(), self.disabled_python_tools.all()
            ),
            mcp_tools=_minus(
                self.allowed_mcp_tools.all(), self.disabled_mcp_tools.all()
            ),
            knowledge_collections=_minus(
                self.allowed_knowledge_collections.all(),
                self.disabled_knowledge_collections.all(),
            ),
            storage_files=_minus(
                self.allowed_storage_files.all(), self.disabled_storage_files.all()
            ),
        )

    def is_available_to(self, agent_definition) -> bool:
        if not self.allowed_agents.exists():
            return True

        return self.allowed_agents.filter(pk=agent_definition.pk).exists()


class InlineSurface(BaseSurface):
    class Meta(BaseSurface.Meta):
        abstract = False
