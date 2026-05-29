"""Classifies exceptions raised inside the NaiveRag indexing pipeline into a
(code, formatted_message) pair persisted on `NaiveRagDocumentConfig`.

Codes mirror `tables.NaiveRagDocumentConfig.DocumentErrorCode` on the Django
side so the frontend can render category-specific UI without parsing message
text."""

from __future__ import annotations


class IndexingErrorClassifier:
    ERROR_MESSAGE_MAX_LENGTH = 2000

    CHUNKING_FAILED = "chunking_failed"
    EMBEDDING_FAILED = "embedding_failed"
    EMBEDDER_AUTH = "embedder_auth"
    EMBEDDER_RATE_LIMIT = "embedder_rate_limit"

    @classmethod
    def for_chunking(cls, exc: BaseException) -> tuple[str, str]:
        return cls.CHUNKING_FAILED, cls.format_message(exc)

    @classmethod
    def for_embedding(cls, exc: BaseException) -> tuple[str, str]:
        name = type(exc).__name__.lower()
        if "auth" in name or "permissiondenied" in name:
            return cls.EMBEDDER_AUTH, cls.format_message(exc)
        if "ratelimit" in name or "toomanyrequests" in name or "quota" in name:
            return cls.EMBEDDER_RATE_LIMIT, cls.format_message(exc)

        status = cls._http_status(exc)
        if status in (401, 403):
            return cls.EMBEDDER_AUTH, cls.format_message(exc)
        if status == 429:
            return cls.EMBEDDER_RATE_LIMIT, cls.format_message(exc)

        return cls.EMBEDDING_FAILED, cls.format_message(exc)

    @classmethod
    def format_message(cls, exc: BaseException) -> str:
        text = f"{type(exc).__name__}: {exc}".strip()
        if len(text) <= cls.ERROR_MESSAGE_MAX_LENGTH:
            return text
        return text[: cls.ERROR_MESSAGE_MAX_LENGTH - 1] + "…"

    @staticmethod
    def _http_status(exc: BaseException) -> int | None:
        for attr in ("status_code", "http_status", "code"):
            value = getattr(exc, attr, None)
            if isinstance(value, int):
                return value
        response = getattr(exc, "response", None)
        if response is not None:
            sc = getattr(response, "status_code", None)
            if isinstance(sc, int):
                return sc
        return None
