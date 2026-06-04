"""Classifies exceptions raised inside the NaiveRag indexing pipeline into a
(code, formatted_message) pair persisted on `NaiveRagDocumentConfig`.

Codes mirror `tables.NaiveRagDocumentConfig.DocumentErrorCode` on the Django
side so the frontend can render category-specific UI without parsing message
text."""

from __future__ import annotations

from src.shared.models import DocumentErrorCode, format_error_message


class IndexingErrorClassifier:
    # Error-code values and message formatting come from src.shared (single source).
    CHUNKING_FAILED = DocumentErrorCode.CHUNKING_FAILED.value
    EMBEDDING_FAILED = DocumentErrorCode.EMBEDDING_FAILED.value

    @classmethod
    def for_chunking(cls, exc: BaseException) -> tuple[str, str]:
        return cls.CHUNKING_FAILED, cls.format_message(exc)

    @classmethod
    def for_embedding(cls, exc: BaseException) -> tuple[str, str]:
        # We deliberately do NOT guess auth / rate-limit from exception names or
        # HTTP status here — that heuristic was brittle across providers (a new
        # provider with different exception names silently fell through). Embedder
        # credential/connectivity problems are validated at model-connection time
        # via test requests; here any embedding failure is just EMBEDDING_FAILED.
        return cls.EMBEDDING_FAILED, cls.format_message(exc)

    @classmethod
    def format_message(cls, exc: BaseException) -> str:
        return format_error_message(exc)
