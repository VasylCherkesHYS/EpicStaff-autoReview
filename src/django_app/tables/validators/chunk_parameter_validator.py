from typing import Any, Dict, List, Optional

from tables.constants.knowledge_constants import (
    FILE_TYPE_SPECIFIC_STRATEGIES,
    MAX_CHUNK_OVERLAP,
    MAX_CHUNK_SIZE,
    MIN_CHUNK_OVERLAP,
    MIN_CHUNK_SIZE,
    UNIVERSAL_STRATEGIES,
)
from tables.exceptions import InvalidChunkParametersException
from tables.models.knowledge_models import NaiveRagDocumentConfig


class ChunkParameterValidator:
    """Single source of NaiveRag chunk-parameter validation and update-dict
    building (size / overlap / strategy↔file-type).

    Shared by the single-update and bulk-update paths so both apply identical
    rules. Errors are returned as a list of ``{field, value, reason}`` dicts
    (empty list = OK), matching the structured-error contract used elsewhere:
      - bulk-update collects errors per config (partial success);
      - single-update calls :meth:`validate_or_raise`.
    """

    # ---- strategy ↔ file-type compatibility ----

    @staticmethod
    def allowed_strategies_for_file_type(file_type: str) -> set:
        return UNIVERSAL_STRATEGIES | FILE_TYPE_SPECIFIC_STRATEGIES.get(
            file_type, set()
        )

    @classmethod
    def is_strategy_allowed(cls, strategy: str, file_type: str) -> bool:
        return strategy in cls.allowed_strategies_for_file_type(file_type)

    # ---- update-dict building ----

    @staticmethod
    def build_updates(
        chunk_size: Optional[int],
        chunk_overlap: Optional[int],
        chunk_strategy: Optional[str],
        additional_params: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Keep only the params that were actually supplied (non-None)."""
        pairs = (
            ("chunk_size", chunk_size),
            ("chunk_overlap", chunk_overlap),
            ("chunk_strategy", chunk_strategy),
            ("additional_params", additional_params),
        )
        return {k: v for k, v in pairs if v is not None}

    # ---- validation ----

    @classmethod
    def validate_field(
        cls,
        field_name: str,
        value: Any,
        config: Optional[NaiveRagDocumentConfig] = None,
    ) -> List[Dict[str, Any]]:
        """Validate a single field. Returns ``{field, value, reason}`` dicts
        (empty list if valid). ``config`` is needed for strategy↔file-type."""
        errors: List[Dict[str, Any]] = []

        if field_name == "chunk_size":
            if value < MIN_CHUNK_SIZE:
                errors.append(
                    {
                        "field": "chunk_size",
                        "value": value,
                        "reason": f"chunk_size too small (min {MIN_CHUNK_SIZE})",
                    }
                )
            elif value > MAX_CHUNK_SIZE:
                errors.append(
                    {
                        "field": "chunk_size",
                        "value": value,
                        "reason": f"chunk_size too large (max {MAX_CHUNK_SIZE})",
                    }
                )

        elif field_name == "chunk_overlap":
            if value < MIN_CHUNK_OVERLAP:
                errors.append(
                    {
                        "field": "chunk_overlap",
                        "value": value,
                        "reason": f"chunk_overlap too small (min {MIN_CHUNK_OVERLAP})",
                    }
                )
            elif value > MAX_CHUNK_OVERLAP:
                errors.append(
                    {
                        "field": "chunk_overlap",
                        "value": value,
                        "reason": f"chunk_overlap too large (max {MAX_CHUNK_OVERLAP})",
                    }
                )

        elif field_name == "chunk_strategy":
            valid_strategies = [
                choice[0] for choice in NaiveRagDocumentConfig.ChunkStrategy.choices
            ]
            if value not in valid_strategies:
                errors.append(
                    {
                        "field": "chunk_strategy",
                        "value": value,
                        "reason": f"Invalid chunk_strategy. Must be one of: {', '.join(valid_strategies)}",
                    }
                )
            elif config and not cls.is_strategy_allowed(
                value, config.document.file_type
            ):
                allowed = cls.allowed_strategies_for_file_type(
                    config.document.file_type
                )
                errors.append(
                    {
                        "field": "chunk_strategy",
                        "value": value,
                        "reason": f"chunk_strategy '{value}' is not valid for file type '{config.document.file_type}'. Allowed: {', '.join(sorted(allowed))}",
                    }
                )

        return errors

    @classmethod
    def collect_errors(
        cls, config: NaiveRagDocumentConfig, updates: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Per-field + cross-field (overlap < size) validation against the
        config's effective post-update values. Empty list = OK."""
        errors: List[Dict[str, Any]] = []
        for field in ("chunk_size", "chunk_overlap"):
            if field in updates:
                errors.extend(cls.validate_field(field, updates[field]))
        if "chunk_strategy" in updates:
            errors.extend(
                cls.validate_field("chunk_strategy", updates["chunk_strategy"], config)
            )

        final_size = updates.get("chunk_size", config.chunk_size)
        final_overlap = updates.get("chunk_overlap", config.chunk_overlap)
        if final_overlap >= final_size:
            errors.append(
                {
                    "field": "chunk_overlap",
                    "value": final_overlap,
                    "reason": (
                        f"chunk_overlap ({final_overlap}) must be less than "
                        f"chunk_size ({final_size})"
                    ),
                }
            )
        return errors

    @classmethod
    def validate_or_raise(
        cls, config: NaiveRagDocumentConfig, updates: Dict[str, Any]
    ) -> None:
        """Single-update convenience: raise with the full error list if invalid."""
        errors = cls.collect_errors(config, updates)
        if errors:
            raise InvalidChunkParametersException(errors=errors)
