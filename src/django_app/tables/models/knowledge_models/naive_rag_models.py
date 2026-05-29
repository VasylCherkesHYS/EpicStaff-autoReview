from django.db import models
from django.utils import timezone
import uuid

from pgvector.django import VectorField


from ..embedding_models import EmbeddingConfig
from .collection_models import BaseRagType, DocumentMetadata
from ..crew_models import Agent


_CHUNK_PARAM_FIELDS = (
    "chunk_size",
    "chunk_overlap",
    "chunk_strategy",
    "additional_params",
)
_SNAPSHOT_FIELD_PAIRS = tuple((f"indexed_{f}", f) for f in _CHUNK_PARAM_FIELDS)


class NaiveRag(models.Model):
    class NaiveRagStatus(models.TextChoices):
        """
        Status of document in SourceCollection
        """

        NEW = "new"
        PROCESSING = "processing"
        COMPLETED = "completed"
        WARNING = "warning"
        FAILED = "failed"

    naive_rag_id = models.AutoField(primary_key=True)
    base_rag_type = models.ForeignKey(
        BaseRagType,
        on_delete=models.CASCADE,
        related_name="naive_rags",
        limit_choices_to={"rag_type": BaseRagType.RagType.NAIVE},
    )
    embedder = models.ForeignKey(
        EmbeddingConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    agents = models.ManyToManyField(
        "Agent",
        through="AgentNaiveRag",
        related_name="naive_rags",  # Access from Agent: agent.naive_rags.all()
        blank=True,
        help_text="Agents that have access to this NaiveRag",
    )
    rag_status = models.CharField(
        max_length=20,
        choices=NaiveRagStatus.choices,
        default=NaiveRagStatus.NEW,
    )
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    indexed_at = models.DateTimeField(null=True, blank=True)

    def update_rag_status(self: "NaiveRag"):
        doc_statuses = set(self.naive_rag_configs.values_list("status", flat=True))

        DocStatus = NaiveRagDocumentConfig.NaiveRagDocumentStatus
        IN_PROGRESS = {DocStatus.CHUNKING, DocStatus.CHUNKED, DocStatus.INDEXING}

        RagStatus = NaiveRag.NaiveRagStatus

        if not doc_statuses or doc_statuses == {DocStatus.NEW}:
            current_status = RagStatus.NEW
        elif doc_statuses & IN_PROGRESS:
            current_status = RagStatus.PROCESSING
        elif doc_statuses == {DocStatus.COMPLETED}:
            current_status = RagStatus.COMPLETED
        elif doc_statuses == {DocStatus.FAILED}:
            current_status = RagStatus.FAILED
        else:
            # mix (completed+new / completed+failed / new+failed / ...) → warning
            current_status = RagStatus.WARNING

        self.rag_status = current_status
        self.save(update_fields=["rag_status", "updated_at"])


class NaiveRagDocumentConfig(models.Model):
    """
    Document-level RAG type with per-document parameters.

    Scope: Per-document processing

    Relationships:
    - Belongs to one DocumentMetadata
    - Has many NaiveRAGChunk (chunks from this document)
    - Has many NaiveRAGEmbedding (embeddings from this document)
    """

    class ChunkStrategy(models.TextChoices):
        TOKEN = "token"
        CHARACTER = "character"
        MARKDOWN = "markdown"
        JSON = "json"
        HTML = "html"
        CSV = "csv"

    class NaiveRagDocumentStatus(models.TextChoices):
        # Flow: new → chunking → chunked → indexing → completed. failed/warning at any step.
        NEW = "new"
        CHUNKING = "chunking"
        CHUNKED = "chunked"
        INDEXING = "indexing"
        COMPLETED = "completed"
        WARNING = "warning"
        FAILED = "failed"

    class DocumentErrorCode(models.TextChoices):
        CHUNKING_FAILED = "chunking_failed"
        EMBEDDING_FAILED = "embedding_failed"
        EMBEDDER_AUTH = "embedder_auth"
        EMBEDDER_RATE_LIMIT = "embedder_rate_limit"
        UNKNOWN = "unknown"

    ERROR_MESSAGE_MAX_LENGTH = 2000

    # Statuses meaning "a worker is actively touching this row right now".
    # CHUNKED is NOT here — it means "preview ready, awaiting user action".
    IN_PROGRESS_STATUSES = frozenset({"chunking", "indexing"})

    naive_rag_document_id = models.AutoField(primary_key=True)

    naive_rag = models.ForeignKey(
        NaiveRag, on_delete=models.CASCADE, related_name="naive_rag_configs"
    )

    document = models.ForeignKey(
        DocumentMetadata,
        on_delete=models.CASCADE,
        related_name="naive_rag_document_config",
    )

    chunk_strategy = models.CharField(
        max_length=20,
        choices=ChunkStrategy.choices,
        default=ChunkStrategy.TOKEN,
    )
    chunk_size = models.PositiveIntegerField(
        default=1000, help_text="Size of each chunk (tokens or characters)"
    )
    chunk_overlap = models.PositiveIntegerField(
        default=150, help_text="Overlap between consecutive chunks"
    )

    additional_params = models.JSONField(
        default=dict, help_text="Strategy-specific params (e.g., separators, headers)"
    )

    status = models.CharField(
        max_length=20,
        choices=NaiveRagDocumentStatus.choices,
        default=NaiveRagDocumentStatus.NEW,
    )

    error_message = models.TextField(null=True, blank=True)
    error_code = models.CharField(
        max_length=32,
        choices=DocumentErrorCode.choices,
        null=True,
        blank=True,
    )
    failed_at = models.DateTimeField(null=True, blank=True)

    # Snapshot of chunk params that produced the currently-stored
    # chunks/embeddings. NULL ⇒ never indexed with current params.
    # Written only on success; consulted by IndexingService to short-circuit
    # no-op reindex requests.
    indexed_chunk_strategy = models.CharField(
        max_length=20,
        choices=ChunkStrategy.choices,
        null=True,
        blank=True,
    )
    indexed_chunk_size = models.PositiveIntegerField(null=True, blank=True)
    indexed_chunk_overlap = models.PositiveIntegerField(null=True, blank=True)
    indexed_additional_params = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    @property
    def total_chunks(self):
        return self.chunks.count()

    @property
    def total_embeddings(self):
        return self.embeddings.count()

    @classmethod
    def format_error_message(cls, exc: BaseException) -> str:
        raw = f"{type(exc).__name__}: {exc}"
        n = cls.ERROR_MESSAGE_MAX_LENGTH
        return raw if len(raw) <= n else raw[: n - 1] + "…"

    def is_snapshot_current(self) -> bool:
        return all(
            getattr(self, snap) is not None
            and getattr(self, snap) == getattr(self, live)
            for snap, live in _SNAPSHOT_FIELD_PAIRS
        )

    def _clear_error(self) -> None:
        self.error_message = None
        self.error_code = None
        self.failed_at = None

    def apply_param_updates(self, updates: dict) -> bool:
        """Apply chunk-param `updates` in place. If any param really changed:
        drop the stale preview and — unless a worker is actively running —
        realign `status` to COMPLETED (snapshot still current, e.g. revert)
        or NEW (snapshot stale). Returns True iff anything changed."""
        changed = any(
            f in updates and updates[f] != getattr(self, f) for f in _CHUNK_PARAM_FIELDS
        )
        for f, v in updates.items():
            setattr(self, f, v)
        if not changed:
            self.save()
            return False

        NaiveRagPreviewChunk.objects.filter(
            naive_rag_document_config_id=self.naive_rag_document_id
        ).delete()

        if self.status not in self.IN_PROGRESS_STATUSES:
            S = self.NaiveRagDocumentStatus
            self.status = S.COMPLETED if self.is_snapshot_current() else S.NEW
            self._clear_error()

        self.save()
        return True

    def start_attempt(self, new_status) -> None:
        """Begin a chunking/indexing attempt: flip status and clear stale error."""
        self.status = new_status
        self._clear_error()
        self.save(update_fields=["status", "error_message", "error_code", "failed_at"])

    def mark_failed(self, error_code, exc: BaseException) -> str:
        """Persist FAILED + code + truncated message + timestamp. Returns the message."""
        message = self.format_error_message(exc)
        self.status = self.NaiveRagDocumentStatus.FAILED
        self.error_code = error_code
        self.error_message = message
        self.failed_at = timezone.now()
        self.save(update_fields=["status", "error_code", "error_message", "failed_at"])
        return message

    class Meta:
        indexes = [
            models.Index(fields=["naive_rag", "status"]),
            models.Index(fields=["document"]),
        ]
        # support only one configuration of document per one naive rag implementation
        # (could be many implementations per collection)
        constraints = [
            models.UniqueConstraint(
                fields=["naive_rag", "document"],
                name="unique_document_per_naive_rag",
            )
        ]

    def __str__(self):
        return f"NaiveRAG: {self.document.file_name}"


class NaiveRagChunk(models.Model):
    """
    Text chunks generated by NaiveRAG strategy.
    """

    chunk_id = models.AutoField(primary_key=True)

    naive_rag_document_config = models.ForeignKey(
        NaiveRagDocumentConfig,
        on_delete=models.CASCADE,
        related_name="chunks",
    )

    text = models.TextField()
    chunk_index = models.PositiveIntegerField(
        help_text="Order of this chunk in the document"
    )

    token_count = models.PositiveIntegerField(null=True, blank=True)
    overlap_start_index = models.PositiveIntegerField(null=True, blank=True)
    overlap_end_index = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(
        default=dict, help_text="Chunk-specific metadata (page numbers, sections, etc.)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["chunk_index"]
        indexes = [
            models.Index(fields=["naive_rag_document_config", "chunk_index"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["naive_rag_document_config", "chunk_index"],
                name="unique_chunk_index_per_naive_rag_document_config",
            )
        ]

    def __str__(self):
        return f"Chunk {self.chunk_index} of {self.naive_rag_document_config.document.file_name}"


class NaiveRagEmbedding(models.Model):
    """
    Vector embeddings for NaiveRAG chunks.
    """

    embedding_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )

    naive_rag_document_config = models.ForeignKey(
        NaiveRagDocumentConfig,
        on_delete=models.CASCADE,
        related_name="embeddings",
    )
    chunk = models.OneToOneField(
        NaiveRagChunk,
        on_delete=models.CASCADE,
        related_name="embedding",
    )

    vector = VectorField(
        dimensions=None,  # Flexible dimensions based on embedder
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["naive_rag_document_config"])]

    def __str__(self):
        return f"Embedding for {self.chunk}"


class AgentNaiveRag(models.Model):
    """
    Link table connecting Agents to NaiveRag implementations.

    Purpose:
    - Enables ManyToMany relationship without modifying Agent model
    - Allows adding future RAG types (GraphRag, HybridRag) independently
    - Could stores relationship metadata (priority, is_active)

    Current Restriction:
    - agent field has unique=True: temporarily enforces ONE NaiveRag per Agent
    - Remove unique=True later to allow multiple NaiveRags per Agent

    Design Pattern:
    - Relationship defined on NaiveRag model, not Agent
    - Agent accesses via reverse relation: agent.naive_rags.all()
    - Keeps Agent model clean and unchanged when adding new RAG types
    """

    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        unique=True,  # TEMPORARY: Remove to allow multiple NaiveRags per Agent
        related_name="agent_naive_rags",
    )
    naive_rag = models.ForeignKey(
        NaiveRag, on_delete=models.CASCADE, related_name="agent_links"
    )

    @classmethod
    def check(cls, **kwargs):
        """
        Suppress W342 warning about ForeignKey(unique=True).
        This is intentional: currently 1-to-1, future Many-to-Many.
        """
        errors = super().check(**kwargs)
        return [error for error in errors if error.id != "fields.W342"]


class NaiveRagSearchConfig(models.Model):
    agent = models.OneToOneField(
        "Agent",
        on_delete=models.CASCADE,
        related_name="naive_search_config",  # Access via: agent.naive_search_config
        help_text="Agent this search configuration belongs to",
    )

    search_limit = models.PositiveIntegerField(
        default=3, blank=True, help_text="Integer between 0 and 1000 for knowledge"
    )
    similarity_threshold = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.2,
        blank=True,
        help_text="Float between 0.00 and 1.00 for knowledge",
    )


class NaiveRagPreviewChunk(models.Model):
    """
    Temporary preview chunks for testing different chunking parameters.

    Purpose:
    - Allow users to preview chunks before committing to indexing
    - Support iterative chunking parameter tuning

    Lifecycle:
    - Created when user triggers process-chunking endpoint
    - Deleted when:
      1. New chunking request arrives (replaced with new preview chunks)
      2. Document is successfully indexed (no longer needed)
    """

    preview_chunk_id = models.AutoField(primary_key=True)

    naive_rag_document_config = models.ForeignKey(
        NaiveRagDocumentConfig,
        on_delete=models.CASCADE,
        related_name="preview_chunks",
    )

    text = models.TextField()
    chunk_index = models.PositiveIntegerField(
        help_text="Order of this chunk in the document"
    )

    token_count = models.PositiveIntegerField(null=True, blank=True)
    overlap_start_index = models.PositiveIntegerField(null=True, blank=True)
    overlap_end_index = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(
        default=dict,
        help_text="Chunk-specific metadata (page numbers, sections, etc.)",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["chunk_index"]
        indexes = [
            models.Index(fields=["naive_rag_document_config", "chunk_index"]),
        ]

    def __str__(self):
        return f"PreviewChunk {self.chunk_index} of {self.naive_rag_document_config.document.file_name}"
