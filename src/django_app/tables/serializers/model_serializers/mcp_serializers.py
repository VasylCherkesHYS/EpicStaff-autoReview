from rest_framework import serializers

from tables.models.mcp_models import McpTool


class McpToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = McpTool
        fields = "__all__"
        read_only_fields = ["org", "created_by"]
