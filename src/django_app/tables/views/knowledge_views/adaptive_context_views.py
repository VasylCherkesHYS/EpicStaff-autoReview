from drf_spectacular.utils import OpenApiExample, extend_schema
from loguru import logger
from pydantic import ValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from src.shared.models.adaptive_context import (
    GraphRagSuggestRequest,
    NaiveRagSuggestRequest,
    SuggestResponse,
)
from tables.exceptions import (
    CollectionNotFoundException,
    GraphRagArtifactMissingException,
    GraphRagIndexNotReadyException,
    LLMConfigNotFoundException,
    NoGraphRagForCollectionException,
)
from tables.models.llm_models import LLMConfig
from tables.serializers.adaptive_context_serializers import (
    ErrorResponseSerializer,
    GraphRagSuggestRequestSerializer,
    NaiveRagSuggestRequestSerializer,
    SuggestResponseSerializer,
    ValidationErrorResponseSerializer,
)
from tables.services.knowledge_services.adaptive_context_service import (
    build_naive_params,
    get_graph_strategy,
    recommend_graph_search_method,
    safe_budget,
)
from tables.services.knowledge_services.collection_management_service import (
    CollectionManagementService,
)
from tables.utils.llm_context_windows import resolve_context_window


def _validation_error_response(exc: ValidationError) -> Response:
    return Response(
        {
            "error": "Validation error",
            "details": [
                {"field": ".".join(str(p) for p in err["loc"]), "msg": err["msg"]}
                for err in exc.errors()
            ],
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def _resolve_llm_ctx(llm_config_id: int) -> tuple[int, str, str | None, bool]:
    """Resolve (effective_ctx, resolved_llm_name, warning, is_trusted) for an LLMConfig ID.

    `is_trusted=True` when ctx came from litellm; False when it came from
    LLMConfig.context_window override or the global fallback.
    """
    try:
        cfg = LLMConfig.objects.select_related("model").get(pk=llm_config_id)
    except LLMConfig.DoesNotExist:
        raise LLMConfigNotFoundException(llm_config_id)

    model_name = cfg.model.name if cfg.model else ""
    user_override = getattr(cfg, "context_window", None)
    ctx, warning, is_trusted = resolve_context_window(model_name, user_override)
    return ctx, model_name, warning, is_trusted


def _build_response(
    metrics,
    ctx,
    llm_name,
    warning,
    suggested,
    clamped,
    is_trusted: bool,
    recommended_method: str | None = None,
) -> Response:
    payload = SuggestResponse(
        metrics=metrics,
        resolved_llm_name=llm_name or None,
        llm_resolution_warning=warning,
        effective_llm_context_window=ctx,
        safe_token_budget=safe_budget(ctx, is_trusted),
        clamped_fields=clamped,
        suggested_params=suggested,
        recommended_search_method=recommended_method,
    )
    return Response(payload.model_dump(), status=status.HTTP_200_OK)


class NaiveRagSuggestParamsView(APIView):
    serializer_class = NaiveRagSuggestRequestSerializer

    @extend_schema(
        operation_id="naive_rag_suggest_search_params",
        summary="Suggest NaiveRag search params for a collection + LLM",
        description=(
            "Stateless. Computes adaptive `search_limit` and "
            "`similarity_threshold` for a NaiveRag collection sized for the "
            "target LLM's context window. Pass overrides via "
            "`user_custom_params` to lock specific fields."
        ),
        request=NaiveRagSuggestRequestSerializer,
        responses={
            200: SuggestResponseSerializer,
            400: ValidationErrorResponseSerializer,
            404: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        examples=[
            OpenApiExample(
                "Minimal — use all suggested defaults",
                value={
                    "knowledge_collection_id": 1,
                    "llm_config_id": 1,
                },
                request_only=True,
            ),
            OpenApiExample(
                "With user overrides",
                value={
                    "knowledge_collection_id": 1,
                    "llm_config_id": 1,
                    "user_custom_params": {
                        "search_limit": 7,
                        "similarity_threshold": 0.25,
                    },
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        try:
            req = NaiveRagSuggestRequest(**(request.data or {}))
        except ValidationError as exc:
            return _validation_error_response(exc)

        try:
            ctx, llm_name, warning, is_trusted = _resolve_llm_ctx(req.llm_config_id)
            metrics = CollectionManagementService.get_collection_metrics(
                req.knowledge_collection_id, "naive"
            )
            suggested, clamped = build_naive_params(metrics, req.user_custom_params)
        except (CollectionNotFoundException, LLMConfigNotFoundException) as exc:
            # These exceptions inherit non-404 status_code from base classes;
            # override here because semantically they are 404 (resource missing).
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            logger.exception("Unexpected error in NaiveRagSuggestParamsView")
            return Response(
                {"error": f"An unexpected error occurred: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return _build_response(
            metrics, ctx, llm_name, warning, suggested, clamped, is_trusted
        )


class GraphRagSuggestParamsView(APIView):
    serializer_class = GraphRagSuggestRequestSerializer

    @extend_schema(
        operation_id="graph_rag_suggest_search_params",
        summary="Suggest GraphRag search params for a collection + LLM",
        description=(
            "Stateless. Computes adaptive params for one of the four Graph "
            "RAG search methods (`basic`, `local`, `global_search`, "
            "`drift_search`). Token fields are clamped to "
            "`safe_token_budget` unless the LLM model could not be resolved "
            "by litellm (see `llm_resolution_warning`)."
        ),
        request=GraphRagSuggestRequestSerializer,
        responses={
            200: SuggestResponseSerializer,
            400: ValidationErrorResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            500: ErrorResponseSerializer,  # GraphRagArtifactMissingException + unexpected
        },
        examples=[
            OpenApiExample(
                "Basic search — defaults",
                value={
                    "knowledge_collection_id": 1,
                    "search_method": "basic",
                    "llm_config_id": 1,
                },
                request_only=True,
            ),
            OpenApiExample(
                "Local search with text-unit override",
                value={
                    "knowledge_collection_id": 1,
                    "search_method": "local",
                    "llm_config_id": 1,
                    "user_custom_params": {
                        "text_unit_prop": 0.7,
                        "top_k_entities": 12,
                    },
                },
                request_only=True,
            ),
            OpenApiExample(
                "Global search",
                value={
                    "knowledge_collection_id": 1,
                    "search_method": "global_search",
                    "llm_config_id": 1,
                },
                request_only=True,
            ),
            OpenApiExample(
                "Drift search",
                value={
                    "knowledge_collection_id": 1,
                    "search_method": "drift_search",
                    "llm_config_id": 1,
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        try:
            req = GraphRagSuggestRequest(**(request.data or {}))
        except ValidationError as exc:
            return _validation_error_response(exc)

        try:
            strategy = get_graph_strategy(req.search_method)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ctx, llm_name, warning, is_trusted = _resolve_llm_ctx(req.llm_config_id)
            metrics = CollectionManagementService.get_collection_metrics(
                req.knowledge_collection_id, "graph"
            )
            suggested, clamped = strategy.builder(
                metrics, ctx, is_trusted, req.user_custom_params
            )
        except (CollectionNotFoundException, LLMConfigNotFoundException) as exc:
            # See NaiveRagSuggestParamsView.post for status-code rationale.
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except (
            NoGraphRagForCollectionException,
            GraphRagIndexNotReadyException,
            GraphRagArtifactMissingException,
        ) as exc:
            return Response({"error": str(exc)}, status=exc.status_code)
        except Exception as exc:
            logger.exception("Unexpected error in GraphRagSuggestParamsView")
            return Response(
                {"error": f"An unexpected error occurred: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return _build_response(
            metrics,
            ctx,
            llm_name,
            warning,
            suggested,
            clamped,
            is_trusted,
            recommended_method=recommend_graph_search_method(metrics),
        )
