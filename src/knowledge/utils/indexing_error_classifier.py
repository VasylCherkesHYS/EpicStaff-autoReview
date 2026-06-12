"""Classifies NaiveRag indexing-pipeline exceptions into a (code, message) pair
persisted on `NaiveRagDocumentConfig`. Codes mirror the Django-side
`DocumentErrorCode` so the frontend can render category-specific UI."""

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
        # No auth/rate-limit guessing from exception names: that heuristic was
        # brittle across providers. Credential/connectivity issues are caught at
        # model-connection time; here any embedding failure is EMBEDDING_FAILED.
        return cls.EMBEDDING_FAILED, cls.format_message(exc)

    @classmethod
    def format_message(cls, exc: BaseException) -> str:
        return format_error_message(exc)
