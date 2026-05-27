from rest_framework import serializers

from tables.models.agent_models import AgentDefinition, Surface
from tables.models.llm_models import LLMConfig


class AgentDefinitionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentDefinition
        fields = [
            "id",
            "organization",
            "name",
            "role",
            "instructions",
            "llm_config",
            "fcm_llm_config",
            "default_surface",
            "max_iter",
            "max_rpm",
            "max_execution_time",
            "cache",
            "max_retry_limit",
            "default_temperature",
        ]
        read_only_fields = fields


class AgentDefinitionWriteSerializer(serializers.ModelSerializer):
    llm_config = serializers.PrimaryKeyRelatedField(
        queryset=LLMConfig.objects.all(),
        required=False,
        allow_null=True,
    )
    fcm_llm_config = serializers.PrimaryKeyRelatedField(
        queryset=LLMConfig.objects.all(),
        required=False,
        allow_null=True,
    )
    default_surface = serializers.PrimaryKeyRelatedField(
        queryset=Surface.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AgentDefinition
        fields = [
            "name",
            "role",
            "instructions",
            "llm_config",
            "fcm_llm_config",
            "default_surface",
            "max_iter",
            "max_rpm",
            "max_execution_time",
            "cache",
            "max_retry_limit",
            "default_temperature",
        ]
