from __future__ import annotations

from dataclasses import dataclass

import jsonschema

from shared.models.agent_service import TokenUsage


@dataclass(frozen=True)
class ValidationOutcome:
    ok: bool
    parsed: dict | None = None
    error: str | None = None


def as_object_schema(schema: dict) -> tuple[dict, bool]:
    """Tool input schemas must be type:object. Wrap non-object schemas under 'result'."""
    if isinstance(schema, dict) and schema.get("type") == "object":
        return schema, False

    return {
        "type": "object",
        "properties": {"result": schema},
        "required": ["result"],
    }, True


def validate_output(obj, schema: dict) -> ValidationOutcome:
    try:
        jsonschema.validate(obj, schema)
        return ValidationOutcome(ok=True, parsed=obj)

    except jsonschema.ValidationError as error:
        return ValidationOutcome(ok=False, error=error.message)


def add_usage(a: TokenUsage, b: TokenUsage) -> TokenUsage:
    return TokenUsage(
        prompt_tokens=a.prompt_tokens + b.prompt_tokens,
        completion_tokens=a.completion_tokens + b.completion_tokens,
        total_tokens=a.total_tokens + b.total_tokens,
    )
