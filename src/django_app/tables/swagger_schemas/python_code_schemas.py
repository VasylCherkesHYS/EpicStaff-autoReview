from drf_spectacular.utils import OpenApiResponse, OpenApiExample
from drf_spectacular.types import OpenApiTypes

RUN_PYTHON_CODE_POST = dict(
    summary="Run Python Code",
    description="Executes a Python code node with the provided variables and returns an execution ID to track the run.",
    responses={
        200: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Python code execution started successfully",
            examples=[
                OpenApiExample(
                    "Execution started",
                    value={"execution_id": 42},
                    response_only=True,
                ),
            ],
        ),
        400: OpenApiResponse(
            response=OpenApiTypes.STR,
            description="Bad Request",
            examples=[
                OpenApiExample(
                    "Validation error",
                    value={"error": "Invalid input data."},
                    response_only=True,
                ),
            ],
        ),
    },
)
