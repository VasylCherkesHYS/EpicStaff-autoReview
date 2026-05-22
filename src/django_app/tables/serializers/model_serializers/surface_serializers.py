from rest_framework import serializers

from tables.models.agent_models import AgentDefinition, Surface
from tables.models.crew_models import ToolConfig
from tables.models.graph_models import StorageFile
from tables.models.knowledge_models.collection_models import SourceCollection
from tables.models.mcp_models import McpTool
from tables.models.python_models import PythonCodeToolConfig
from tables.services.surface_service import SurfaceService


class SurfaceReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Surface
        fields = [
            "id",
            "organization",
            "name",
            "description",
            "additional_instructions",
            "parent",
            "allowed_agents",
            "tool_configs",
            "python_code_tool_configs",
            "mcp_tools",
            "knowledge_collections",
            "storage_files",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SurfaceWriteSerializer(serializers.ModelSerializer):
    allowed_agents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AgentDefinition.objects.all(), required=False
    )
    tool_configs = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ToolConfig.objects.all(), required=False
    )
    python_code_tool_configs = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PythonCodeToolConfig.objects.all(), required=False
    )
    mcp_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=McpTool.objects.all(), required=False
    )
    knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SourceCollection.objects.all(), required=False
    )
    storage_files = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StorageFile.objects.all(), required=False
    )
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Surface.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Surface
        fields = [
            "name",
            "description",
            "additional_instructions",
            "parent",
            "allowed_agents",
            "tool_configs",
            "python_code_tool_configs",
            "mcp_tools",
            "knowledge_collections",
            "storage_files",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        organization = self.context.get("organization")

        if organization is not None:
            self.fields["parent"].queryset = Surface.objects.filter(
                organization=organization
            )

    def validate(self, attrs):
        SurfaceService.validate_surface_data(
            instance=self.instance,
            organization=self.context["organization"],
            attrs=attrs,
        )
        return attrs


class ResolvedSurfaceSerializer(serializers.Serializer):
    additional_instructions = serializers.CharField(read_only=True)
    tool_configs = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    python_code_tool_configs = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True
    )
    mcp_tools = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True
    )
    storage_files = serializers.PrimaryKeyRelatedField(many=True, read_only=True)


class CombineSurfacesSerializer(serializers.Serializer):
    surface_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), min_length=1
    )
