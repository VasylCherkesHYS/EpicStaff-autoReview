"""Single source of truth for NaiveRag indexing-status rules.

Imported by BOTH the Django app (`tables.*`) and the knowledge worker
(`rag.*`). MUST stay pure Python — no Django, no SQLAlchemy imports — so it can
load in either process. Each service still owns its own DB read/write (different
ORMs); only the *rules and string values* live here.
"""

from __future__ import annotations

from enum import Enum
from typing import Iterable, Mapping


class DocumentStatus(str, Enum):
    """Per-document (NaiveRagDocumentConfig) lifecycle.
    Flow: new → chunking → chunked → indexing → completed. failed/warning anytime."""

    NEW = "new"
    CHUNKING = "chunking"
    CHUNKED = "chunked"
    INDEXING = "indexing"
    COMPLETED = "completed"
    WARNING = "warning"
    FAILED = "failed"


class RagStatus(str, Enum):
    """Aggregate (NaiveRag) status rolled up from per-document statuses."""

    NEW = "new"
    PROCESSING = "processing"
    COMPLETED = "completed"
    WARNING = "warning"
    FAILED = "failed"


class DocumentErrorCode(str, Enum):
    """Categorized indexing error codes persisted on a document config."""

    CHUNKING_FAILED = "chunking_failed"
    EMBEDDING_FAILED = "embedding_failed"
    EMBEDDER_AUTH = "embedder_auth"
    EMBEDDER_RATE_LIMIT = "embedder_rate_limit"
    UNKNOWN = "unknown"


# Chunk-param fields snapshotted into `indexed_*` columns on successful indexing.
CHUNK_PARAM_FIELDS = (
    "chunk_size",
    "chunk_overlap",
    "chunk_strategy",
    "additional_params",
)

# Doc statuses that make the RAG roll up to PROCESSING.
# NOTE: deliberately DIFFERENT from the Django-only race-guard
# (`RACE_GUARD_IN_PROGRESS` below). `chunked` belongs here (a previewed-but-not-
# indexed doc keeps the RAG "in progress") but NOT in the race-guard.
AGGREGATION_IN_PROGRESS = frozenset(
    {
        DocumentStatus.CHUNKING.value,
        DocumentStatus.CHUNKED.value,
        DocumentStatus.INDEXING.value,
    }
)

# Doc statuses meaning "a worker is actively mutating this row right now".
# Used only by the Django IndexingService / apply_param_updates as a race-guard.
# `chunked` is intentionally excluded: it is a preview/editing state, not work.
RACE_GUARD_IN_PROGRESS = frozenset(
    {DocumentStatus.CHUNKING.value, DocumentStatus.INDEXING.value}
)

ERROR_MESSAGE_MAX_LENGTH = 2000


def compute_rag_status(doc_statuses: Iterable[str]) -> str:
    """Roll per-document status strings up to a single RAG status string.

    Rules (first match wins):
      - empty or all NEW            → NEW
      - any AGGREGATION_IN_PROGRESS → PROCESSING
      - all COMPLETED               → COMPLETED
      - all FAILED                  → FAILED
      - otherwise (mixed)           → WARNING
    """
    statuses = set(doc_statuses)
    if not statuses or statuses == {DocumentStatus.NEW.value}:
        return RagStatus.NEW.value
    if statuses & AGGREGATION_IN_PROGRESS:
        return RagStatus.PROCESSING.value
    if statuses == {DocumentStatus.COMPLETED.value}:
        return RagStatus.COMPLETED.value
    if statuses == {DocumentStatus.FAILED.value}:
        return RagStatus.FAILED.value
    return RagStatus.WARNING.value


def summarize_rag_error(doc_statuses: Iterable[str]) -> str | None:
    """Short RAG-level error summary, or None when nothing is wrong.

    Returns a message whenever at least one document is FAILED/WARNING (so the
    aggregate RAG carries a human-readable hint alongside per-doc detail).
    Returns None otherwise so the field clears on recovery.
    """
    statuses = list(doc_statuses)
    total = len(statuses)
    problems = sum(
        1
        for s in statuses
        if s in (DocumentStatus.FAILED.value, DocumentStatus.WARNING.value)
    )
    if not problems:
        return None
    return f"{problems} of {total} document(s) failed or produced warnings."


def is_snapshot_current(live: Mapping, indexed: Mapping) -> bool:
    """True iff every chunk param has a non-null snapshot equal to the live value.

    `live` and `indexed` are mappings keyed by CHUNK_PARAM_FIELDS (e.g. live
    `chunk_size` vs snapshot `indexed_chunk_size`).
    """
    return all(
        indexed.get(f) is not None and indexed.get(f) == live.get(f)
        for f in CHUNK_PARAM_FIELDS
    )


def format_error_message(exc: BaseException) -> str:
    """`"TypeName: text"` truncated to ERROR_MESSAGE_MAX_LENGTH (with ellipsis).

    For DB errors, prefer the underlying DBAPI exception (`exc.orig`): SQLAlchemy
    stringifies with the full SQL statement and bound parameters, which would
    leak document/chunk content into logs and the stored error_message. The
    DBAPI error carries only the message + key (e.g. the violated constraint).
    """
    base = getattr(exc, "orig", None) or exc
    raw = f"{type(exc).__name__}: {base}"
    n = ERROR_MESSAGE_MAX_LENGTH
    return raw if len(raw) <= n else raw[: n - 1] + "…"
