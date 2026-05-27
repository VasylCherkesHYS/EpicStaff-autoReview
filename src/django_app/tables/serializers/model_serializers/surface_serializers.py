from rest_framework import serializers

from tables.models.agent_models import AgentDefinition, InlineSurface, Surface
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
            "allowed_agents",
            "allowed_python_tools",
            "disabled_python_tools",
            "allowed_mcp_tools",
            "disabled_mcp_tools",
            "allowed_knowledge_collections",
            "disabled_knowledge_collections",
            "allowed_storage_files",
            "disabled_storage_files",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SurfaceWriteSerializer(serializers.ModelSerializer):
    allowed_agents = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AgentDefinition.objects.all(), required=False
    )
    allowed_python_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PythonCodeToolConfig.objects.all(), required=False
    )
    disabled_python_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PythonCodeToolConfig.objects.all(), required=False
    )
    allowed_mcp_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=McpTool.objects.all(), required=False
    )
    disabled_mcp_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=McpTool.objects.all(), required=False
    )
    allowed_knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SourceCollection.objects.all(), required=False
    )
    disabled_knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SourceCollection.objects.all(), required=False
    )
    allowed_storage_files = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StorageFile.objects.all(), required=False
    )
    disabled_storage_files = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StorageFile.objects.all(), required=False
    )

    class Meta:
        model = Surface
        fields = [
            "name",
            "description",
            "additional_instructions",
            "allowed_agents",
            "allowed_python_tools",
            "disabled_python_tools",
            "allowed_mcp_tools",
            "disabled_mcp_tools",
            "allowed_knowledge_collections",
            "disabled_knowledge_collections",
            "allowed_storage_files",
            "disabled_storage_files",
        ]

    def validate(self, attrs):
        SurfaceService.validate_surface_data(
            instance=self.instance,
            organization=self.context["organization"],
            attrs=attrs,
        )
        return attrs


class ResolvedSurfaceSerializer(serializers.Serializer):
    additional_instructions = serializers.CharField(read_only=True)
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


class InlineSurfaceReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = InlineSurface
        fields = [
            "id",
            "organization",
            "allowed_python_tools",
            "disabled_python_tools",
            "allowed_mcp_tools",
            "disabled_mcp_tools",
            "allowed_knowledge_collections",
            "disabled_knowledge_collections",
            "allowed_storage_files",
            "disabled_storage_files",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class InlineSurfaceWriteSerializer(serializers.ModelSerializer):
    allowed_python_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PythonCodeToolConfig.objects.all(), required=False
    )
    disabled_python_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PythonCodeToolConfig.objects.all(), required=False
    )
    allowed_mcp_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=McpTool.objects.all(), required=False
    )
    disabled_mcp_tools = serializers.PrimaryKeyRelatedField(
        many=True, queryset=McpTool.objects.all(), required=False
    )
    allowed_knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SourceCollection.objects.all(), required=False
    )
    disabled_knowledge_collections = serializers.PrimaryKeyRelatedField(
        many=True, queryset=SourceCollection.objects.all(), required=False
    )
    allowed_storage_files = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StorageFile.objects.all(), required=False
    )
    disabled_storage_files = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StorageFile.objects.all(), required=False
    )

    class Meta:
        model = InlineSurface
        fields = [
            "allowed_python_tools",
            "disabled_python_tools",
            "allowed_mcp_tools",
            "disabled_mcp_tools",
            "allowed_knowledge_collections",
            "disabled_knowledge_collections",
            "allowed_storage_files",
            "disabled_storage_files",
        ]
