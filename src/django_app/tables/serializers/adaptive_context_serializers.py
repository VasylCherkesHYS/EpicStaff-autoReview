"""DRF serializers for the adaptive-context suggest endpoints (EST-1429).

Used **only** to describe request/response shapes to drf-spectacular so the
endpoints render a working "Try it out" form in Swagger. Runtime validation
of the request body is still performed by the Pydantic models in
`src.shared.models.adaptive_context`. Keeping the DRF layer doc-only avoids
duplicating the Pydantic invariants in two places.
"""

from typing import get_args

from rest_framework import serializers

from src.shared.models.adaptive_context import GraphSearchMethod


# Single source of truth: the Pydantic `GraphSearchMethod` Literal. Deriving the
# DRF choices from it keeps Swagger and runtime validation from drifting apart.
GRAPH_SEARCH_METHODS = get_args(GraphSearchMethod)


class CollectionMetricsSerializer(serializers.Serializer):
    total_documents = serializers.IntegerField(min_value=0)
    total_chunks = serializers.IntegerField(min_value=0)
    avg_chunk_size = serializers.FloatField(min_value=0)


class NaiveRagSuggestRequestSerializer(serializers.Serializer):
    knowledge_collection_id = serializers.IntegerField(min_value=1)
    llm_config_id = serializers.IntegerField(min_value=1)
    user_custom_params = serializers.DictField(required=False, allow_null=True)


class GraphRagSuggestRequestSerializer(serializers.Serializer):
    knowledge_collection_id = serializers.IntegerField(min_value=1)
    search_method = serializers.ChoiceField(
        choices=GRAPH_SEARCH_METHODS,
        help_text="Graph RAG search method to tune.",
    )
    llm_config_id = serializers.IntegerField(min_value=1)
    user_custom_params = serializers.DictField(required=False, allow_null=True)


class SuggestResponseSerializer(serializers.Serializer):
    metrics = CollectionMetricsSerializer()
    resolved_llm_name = serializers.CharField(allow_null=True, allow_blank=True)
    llm_resolution_warning = serializers.CharField(allow_null=True, allow_blank=True)
    effective_llm_context_window = serializers.IntegerField(min_value=1)
    safe_token_budget = serializers.IntegerField(min_value=1)
    clamped_fields = serializers.ListField(child=serializers.CharField())
    suggested_params = serializers.DictField()
    recommended_search_method = serializers.ChoiceField(
        choices=GRAPH_SEARCH_METHODS, required=False, allow_null=True
    )


class ErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()


class ValidationErrorDetailSerializer(serializers.Serializer):
    field = serializers.CharField()
    msg = serializers.CharField()


class ValidationErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()
    details = ValidationErrorDetailSerializer(many=True)
