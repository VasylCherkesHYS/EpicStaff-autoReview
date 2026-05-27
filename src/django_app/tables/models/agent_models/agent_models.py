from django.db import models

from tables.models import AbstractDefaultFillableModel


class DefaultAgentDefinitionConfig(models.Model):
    """Singleton holding default values for AgentDefinition nullable fields."""

    max_iter = models.IntegerField(
        default=None,
        null=True,
        help_text="Default max reasoning iterations for an AgentDefinition when its own value is null.",
    )
    max_rpm = models.IntegerField(
        default=None,
        null=True,
        help_text="Default max LLM requests per minute when AgentDefinition.max_rpm is null.",
    )
    max_execution_time = models.IntegerField(
        default=None,
        null=True,
        help_text="Default per-run wall-clock budget in seconds when AgentDefinition.max_execution_time is null.",
    )
    cache = models.BooleanField(
        default=None,
        null=True,
        help_text="Default for whether tool-result caching is enabled when AgentDefinition.cache is null.",
    )
    max_retry_limit = models.IntegerField(
        default=None,
        null=True,
        help_text="Default max retries on transient failures when AgentDefinition.max_retry_limit is null.",
    )
    default_temperature = models.FloatField(
        default=None,
        null=True,
        help_text="Default sampling temperature applied when neither the AgentDefinition nor its LLMConfig specify one.",
    )

    @classmethod
    def load(cls) -> "DefaultAgentDefinitionConfig":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __repr__(self) -> str:
        return f"DefaultAgentDefinitionConfig(pk={self.pk})"


class AgentDefinition(AbstractDefaultFillableModel):
    # Identity
    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="agent_definitions",
        help_text="Organization this agent belongs to.",
    )
    name = models.CharField(
        max_length=255,
        help_text="Stable identifier (slug-like) unique within an organization. Used to reference this agent from flows, code, and the UI.",
    )
    role = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Short human-readable persona label, e.g. 'Senior Researcher'.",
    )
    instructions = models.TextField(
        help_text="Free-form prompt for the agent. Put behavior, goals, tone, and constraints here.",
    )

    # LLM linkage
    llm_config = models.ForeignKey(
        "LLMConfig",
        on_delete=models.SET_NULL,
        null=True,
        related_name="agent_definitions",
        default=None,
        help_text="Primary LLM used for reasoning and tool selection.",
    )
    fcm_llm_config = models.ForeignKey(
        "LLMConfig",
        on_delete=models.SET_NULL,
        null=True,
        related_name="fcm_agent_definitions",
        default=None,
        help_text="Optional dedicated LLM for function/tool-call routing. Falls back to llm_config when null.",
    )
    default_surface = models.ForeignKey(
        "Surface",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        default=None,
        related_name="default_for_agents",
        help_text="Surface applied to this agent by default when a node does not specify one. Null means no default surface.",
    )

    # Execution config
    max_iter = models.IntegerField(
        default=None,
        null=True,
        help_text="Max reasoning iterations per task before forcing a final answer. Null falls back to DefaultAgentDefinitionConfig.",
    )
    max_rpm = models.IntegerField(
        default=None,
        null=True,
        help_text="LLM request rate cap (requests per minute). Null falls back to DefaultAgentDefinitionConfig; no cap if both are null.",
    )
    max_execution_time = models.IntegerField(
        default=None,
        null=True,
        help_text="Wall-clock budget in seconds for a single agent run. Null falls back to DefaultAgentDefinitionConfig.",
    )
    cache = models.BooleanField(
        default=None,
        null=True,
        help_text="Enable tool-result caching for this agent. Null falls back to DefaultAgentDefinitionConfig.",
    )
    max_retry_limit = models.IntegerField(
        default=None,
        null=True,
        help_text="Max retries on transient LLM/tool failures. Null falls back to DefaultAgentDefinitionConfig.",
    )
    default_temperature = models.FloatField(
        default=None,
        null=True,
        help_text="Sampling temperature applied when the LLMConfig leaves it unset. Null falls back to DefaultAgentDefinitionConfig.",
    )

    def get_default_model(self):
        return DefaultAgentDefinitionConfig.load()

    def __repr__(self) -> str:
        return f"AgentDefinition(id={self.pk}, name={self.name!r}, role={self.role!r})"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_agent_definition_name_per_organization",
            )
        ]
