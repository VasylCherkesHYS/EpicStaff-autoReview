from drf_spectacular.utils import OpenApiResponse, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from tables.swagger_schemas.common_schemas import UNAUTHORIZED_401_RESPONSE
from tables.serializers.default_config_serializers import (
    DefaultAgentConfigSerializer,
    DefaultConfigSerializer,
    DefaultCrewConfigSerializer,
    DefaultModelsSerializer,
    DefaultRealtimeAgentConfigSerializer,
    DefaultToolConfigSerializer,
)
from tables.serializers.model_serializers import (
    DefaultEmbeddingConfigSerializer,
    DefaultLLMConfigSerializer,
)

DEFAULT_AGENT_CONFIG_GET = dict(
    summary="Get default agent config",
    description="Returns the current default agent configuration.",
    responses={
        200: DefaultAgentConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)


DEFAULT_AGENT_CONFIG_PUT = dict(
    summary="Update default agent config",
    description="Updates the default agent configuration with the provided values.",
    responses={
        200: DefaultAgentConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"max_iter": ["A valid integer is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_CONFIG_GET = dict(
    summary="Get default config",
    description="Returns the full default configuration including agent, realtime agent, crew, and tool configs.",
    responses={
        200: DefaultConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_CREW_CONFIG_GET = dict(
    summary="Get default crew config",
    description="Returns the current default crew configuration.",
    responses={
        200: DefaultCrewConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_CREW_CONFIG_PUT = dict(
    summary="Update default crew config",
    description="Updates the default crew configuration with the provided values.",
    responses={
        200: DefaultCrewConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"process": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_EMBEDDING_CONFIG_GET = dict(
    summary="Get embedding config defaults",
    description="Returns the current default embedding configuration.",
    responses={
        200: DefaultEmbeddingConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Object not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"error": "Object not found"},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_EMBEDDING_CONFIG_PUT = dict(
    summary="Update embedding config defaults",
    description="Updates the default embedding configuration with the provided values.",
    responses={
        200: DefaultEmbeddingConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"field": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Object not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"error": "Object not found"},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_LLM_CONFIG_GET = dict(
    summary="Get llm config defaults",
    description="Returns the current default LLM configuration.",
    responses={
        200: DefaultLLMConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Object not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"error": "Object not found"},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_LLM_CONFIG_PUT = dict(
    summary="Update llm config defaults",
    description="Updates the default LLM configuration with the provided values.",
    responses={
        200: DefaultLLMConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"field": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Object not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"error": "Object not found"},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_MODELS_GET = dict(
    summary="Get default models",
    description="Returns the current default models configuration.",
    responses={
        200: DefaultModelsSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_MODELS_PUT = dict(
    summary="Update default models",
    description="Updates the default models configuration with the provided values.",
    responses={
        200: DefaultModelsSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"field": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_REALTIME_CONFIG_GET = dict(
    summary="Get default realtime config",
    description="Returns the current default realtime agent configuration.",
    responses={
        200: DefaultRealtimeAgentConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_REALTIME_CONFIG_PUT = dict(
    summary="Update default realtime config",
    description="Updates the default realtime agent configuration with the provided values.",
    responses={
        200: DefaultRealtimeAgentConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"field": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_TOOL_CONFIG_GET = dict(
    summary="Get default tool config",
    description="Returns the current default tool configuration.",
    responses={
        200: DefaultToolConfigSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

DEFAULT_TOOL_CONFIG_PUT = dict(
    summary="Update default tool config",
    description="Updates the default tool configuration with the provided values.",
    responses={
        200: DefaultToolConfigSerializer,
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Validation Error",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"field": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Not found",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Not found."},
                    response_only=True,
                ),
            ],
        ),
    },
)

ENVIRONMENT_CONFIG_GET = dict(
    summary="Retrieve environment configuration",
    description="Returns the current environment configuration as a key-value map.",
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Config retrieved successfully",
            examples=[
                OpenApiExample(
                    "Config retrieved",
                    value={"data": {"SOME_KEY": "some_value"}},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
    },
)

ENVIRONMENT_CONFIG_POST = dict(
    summary="Create or update environment configuration ",
    description="Creates or updates one or more environment configuration key-value pairs.",
    responses={
        201: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Config updated successfully",
            examples=[
                OpenApiExample(
                    "Config updated",
                    value={"data": {"SOME_KEY": "some_value"}},
                    response_only=True,
                ),
            ],
        ),
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Invalid config data provided",
            examples=[
                OpenApiExample(
                    "Invalid data",
                    value={"data": ["This field is required."]},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
    },
)

ENVIRONMENT_CONFIG_DELETE = dict(
    summary="Delete an environment configuration key",
    description="Removes a specific key from the environment configuration.",
    responses={
        204: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Config deleted successfully",
            examples=[
                OpenApiExample(
                    "Config deleted",
                    value="Config deleted successfully",
                    response_only=True,
                ),
            ],
        ),
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="No key provided",
            examples=[
                OpenApiExample(
                    "No key provided",
                    value="No key provided",
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Key not found",
            examples=[
                OpenApiExample(
                    "Key not found",
                    value="Key not found",
                    response_only=True,
                ),
            ],
        ),
    },
)

QUICKSTART_GET = dict(
    summary="Get quickstart status",
    description="Returns the list of supported LLM providers, the last applied quickstart configuration, and whether the current setup is synced.",
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="List of supported providers",
            examples=[
                OpenApiExample(
                    "Quickstart status",
                    value={
                        "supported_providers": ["openai", "anthropic"],
                        "last_config": {"config_name": "openai_config"},
                        "is_synced": True,
                    },
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
        500: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Failed to retrieve quickstart status",
            examples=[
                OpenApiExample(
                    "Internal server error",
                    value={"detail": "Failed to retrieve quickstart status"},
                    response_only=True,
                ),
            ],
        ),
    },
)

QUICKSTART_POST = dict(
    summary="Initiate quickstart",
    description="Initiates the quickstart process for a specified provider, creating default configurations and resources as needed.",
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Quickstart initiated successfully",
            examples=[
                OpenApiExample(
                    "Quickstart success",
                    value={
                        "detail": "Quickstart initiated successfully!",
                        "config_name": "openai_config",
                        "configs": {
                            "config_name": "openai_config",
                            "llm_config": {},
                            "embedding_config": {},
                            "realtime_config": {},
                            "realtime_transcription_config": {},
                        },
                    },
                    response_only=True,
                ),
            ],
        ),
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Invalid input or quickstart error",
            examples=[
                OpenApiExample(
                    "Quickstart error",
                    value={"detail": "Error quickstart", "error": "Invalid API key"},
                    response_only=True,
                ),
            ],
        ),
        401: UNAUTHORIZED_401_RESPONSE,
    },
)

QUICKSTART_APPLY_POST = dict(
    summary="Apply quickstart configuration",
    description="Applies the quickstart configuration to the system, activating any new settings or resources created during the quickstart process.",
    responses={
        200: DefaultModelsSerializer,
        401: UNAUTHORIZED_401_RESPONSE,
        404: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="No quickstart config found",
            examples=[
                OpenApiExample(
                    "No quickstart config",
                    value={
                        "detail": "No quickstart config found. Run POST /quickstart/ first."
                    },
                    response_only=True,
                ),
            ],
        ),
    },
)
