import os
from typing import Optional
from loguru import logger
import cachetools

from services.cancellation_token import CancellationToken

from psycopg2.errors import ForeignKeyViolation

from src.shared.models import (
    NaiveRagSearchConfig,
    BaseKnowledgeSearchMessageResponse,
)
from rag.base_rag_strategy import BaseRAGStrategy
from services.chunk_document_service import ChunkDocumentService
from settings import UnitOfWork
from embedder.openai import OpenAIEmbedder
from embedder.gemini import GoogleGenAIEmbedder
from embedder.cohere import CohereEmbedder
from embedder.mistral import MistralEmbedder
from embedder.together_ai import TogetherAIEmbedder


_embedder_cache = cachetools.LRUCache(maxsize=50)


# Indexing error classification.
# Codes mirror tables.NaiveRagDocumentConfig.DocumentErrorCode.
_ERROR_MESSAGE_MAX_LENGTH = 2000
_ERR_CHUNKING_FAILED = "chunking_failed"
_ERR_EMBEDDING_FAILED = "embedding_failed"
_ERR_EMBEDDER_AUTH = "embedder_auth"
_ERR_EMBEDDER_RATE_LIMIT = "embedder_rate_limit"


def _format_error_message(exc: BaseException) -> str:
    text = f"{type(exc).__name__}: {exc}".strip()
    if len(text) > _ERROR_MESSAGE_MAX_LENGTH:
        text = text[: _ERROR_MESSAGE_MAX_LENGTH - 1] + "…"
    return text


def _exc_status_code(exc: BaseException) -> int | None:
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


def _classify_embedder_error(exc: BaseException) -> tuple[str, str]:
    cls_name = type(exc).__name__.lower()
    if "auth" in cls_name or "permissiondenied" in cls_name:
        return _ERR_EMBEDDER_AUTH, _format_error_message(exc)
    if "ratelimit" in cls_name or "toomanyrequests" in cls_name or "quota" in cls_name:
        return _ERR_EMBEDDER_RATE_LIMIT, _format_error_message(exc)

    status = _exc_status_code(exc)
    if status in (401, 403):
        return _ERR_EMBEDDER_AUTH, _format_error_message(exc)
    if status == 429:
        return _ERR_EMBEDDER_RATE_LIMIT, _format_error_message(exc)

    return _ERR_EMBEDDING_FAILED, _format_error_message(exc)


def _classify_chunking_error(exc: BaseException) -> tuple[str, str]:
    return _ERR_CHUNKING_FAILED, _format_error_message(exc)


class NaiveRAGStrategy(BaseRAGStrategy):
    """
    Naive RAG implementation strategy.

    All operations work with naive_rag_id (NOT collection_id).
    Uses ORMNaiveRagStorage for RAG-specific operations.
    """

    RAG_TYPE = "naive"

    def _get_cached_embedder(self, naive_rag_id: int):
        """
        Retrieve embedder from cache or initialize it if not cached.

        Args:
            naive_rag_id: ID of the NaiveRag

        Returns:
            Embedder instance
        """
        if naive_rag_id in _embedder_cache:
            return _embedder_cache[naive_rag_id]

        logger.info(f"Initializing embedder for NaiveRAG with id: {naive_rag_id}")
        uow = UnitOfWork()
        with uow.start() as uow_ctx:
            # Use base storage method with rag_type
            embedder_config = uow_ctx.naive_rag_storage.get_embedder_configuration(
                rag_id=naive_rag_id, rag_type="naive"
            )
        embedder = self._set_embedder_config(embedder_config)

        _embedder_cache[naive_rag_id] = embedder
        return embedder

    def search(
        self,
        rag_id: int,
        uuid: str,
        query: str,
        collection_id: int,
        rag_search_config: NaiveRagSearchConfig,
    ):
        """
        Search for similar chunks in a NaiveRag.

        Args:
            rag_id: ID of the NaiveRag (naive_rag_id)
            uuid: Request UUID
            query: Search query
            search_limit: Maximum number of results
            similarity_threshold: Minimum similarity threshold

        Returns:
            Dict with uuid, rag_id, and results
        """
        naive_rag_id = rag_id
        search_limit = rag_search_config.search_limit
        similarity_threshold = rag_search_config.similarity_threshold
        token_usage = {}

        embedder = self._get_cached_embedder(naive_rag_id=naive_rag_id)

        # Embed the query
        embedded_data = embedder.embed(query)

        if isinstance(embedded_data, dict):
            embedded_query = embedded_data.get("embedding", [])
            token_usage = embedded_data.get("token_usage")
        else:
            embedded_query = embedded_data

        uow = UnitOfWork()
        with uow.start() as uow_ctx:
            # Search using naive_rag_storage

            knowledge_chunk_list = uow_ctx.naive_rag_storage.search(
                naive_rag_id=naive_rag_id,
                embedded_query=embedded_query,
                limit=search_limit,
                similarity_threshold=similarity_threshold,
            )

            knowledge_snippets = []
            for chunk_data in knowledge_chunk_list:
                knowledge_snippets.append(chunk_data.chunk_text)

            # Logging results
            if knowledge_snippets:
                logger.info(f"QUERY: [{query}]")
                if len(knowledge_snippets) > 1:
                    logger.info(
                        f"KNOWLEDGES: {knowledge_snippets[0][:150]}\n.........\n{knowledge_snippets[-1][-150:]}"
                    )
                else:
                    logger.info(f"KNOWLEDGES: {knowledge_snippets[0][:150]}...")
            else:
                logger.warning("NO KNOWLEDGE CHUNKS WERE EXTRACTED!")

        knowledge_query_results = BaseKnowledgeSearchMessageResponse(
            rag_id=naive_rag_id,
            rag_type=self.RAG_TYPE,
            collection_id=collection_id,
            uuid=uuid,
            retrieved_chunks=len(knowledge_chunk_list),
            query=query,
            chunks=knowledge_chunk_list,
            rag_search_config=rag_search_config,
            results=knowledge_snippets,
            token_usage=token_usage,
        )

        return knowledge_query_results.model_dump()

    def process_rag_indexing(
        self,
        rag_id: int,
        document_config_ids: Optional[list[int]] = None,
    ):
        """
        Process RAG indexing (chunking + embedding) for a NaiveRag.

        Args:
            rag_id: ID of the NaiveRag (naive_rag_id)
            document_config_ids: Optional explicit subset of document config IDs.
                If provided, only these configs are processed (skipping any that
                are already COMPLETED to guard against races). If None/empty —
                pick up all NEW/WARNING/CHUNKED/FAILED/INDEXING configs.

        Flow per config:
        1. Wipe existing chunks/embeddings/preview chunks (re-index semantics).
        2. Clear error_message/error_code/failed_at, set status=INDEXING.
        3. Chunk → embed each chunk. On any failure: classify and persist code+message.
        4. On success: status=COMPLETED.
        Finally: recompute parent NaiveRag status.
        """
        naive_rag_id = rag_id

        embedder = self._get_cached_embedder(naive_rag_id=naive_rag_id)
        uow = UnitOfWork()

        with uow.start() as uow_ctx:
            uow_ctx.naive_rag_storage.update_rag_status(
                naive_rag_id=naive_rag_id,
                status="processing",
            )
        logger.info(
            f"Processing embeddings for naive_rag_id: {naive_rag_id}, "
            f"document_config_ids={document_config_ids or 'all'}"
        )

        # Fetch the work list in a read-only tx and detach into plain tuples
        # so subsequent per-doc transactions don't depend on a long-lived session.
        try:
            with uow.start() as uow_ctx:
                if document_config_ids:
                    raw_configs = [
                        uow_ctx.naive_rag_storage.get_naive_rag_document_config_by_id(
                            cid
                        )
                        for cid in document_config_ids
                    ]
                    work_items = [
                        (c.naive_rag_document_id, c.document.file_name)
                        for c in raw_configs
                        if c is not None
                        and c.naive_rag_id == naive_rag_id
                        and c.status != "completed"
                    ]
                else:
                    raw_configs = (
                        uow_ctx.naive_rag_storage.get_naive_rag_document_configs(
                            naive_rag_id=naive_rag_id,
                            status=("new", "warning", "chunked", "failed", "indexing"),
                        )
                    )
                    work_items = [
                        (c.naive_rag_document_id, c.document.file_name)
                        for c in raw_configs
                    ]
        except Exception as e:
            with uow.start() as uow_ctx:
                uow_ctx.naive_rag_storage.update_rag_status(
                    naive_rag_id=naive_rag_id, status="failed"
                )
            logger.error(
                f"Failed to load document configs for naive_rag {naive_rag_id}: {e}"
            )
            return

        if not work_items:
            logger.warning(f"NaiveRag {naive_rag_id}: no document configs to (re)index")

        # Per-document processing — each in its own short-lived transaction so
        # status transitions are visible to polling clients immediately.
        for config_id, file_name in work_items:
            logger.info(
                f"Started processing document {file_name}, config ID: {config_id}"
            )

            # Stage A: wipe stale artifacts, clear error, flip status=indexing.
            # Own tx so the 'indexing' state is visible right away.
            try:
                with uow.start() as uow_ctx:
                    uow_ctx.naive_rag_storage.delete_embeddings(
                        naive_rag_document_config_id=config_id
                    )
                    uow_ctx.naive_rag_storage.delete_chunks(
                        naive_rag_document_config_id=config_id
                    )
                    try:
                        uow_ctx.naive_rag_storage.delete_preview_chunks(
                            naive_rag_document_config_id=config_id
                        )
                    except Exception:
                        # Preview chunks are best-effort; don't block the run.
                        pass
                    uow_ctx.naive_rag_storage.clear_document_config_error(
                        naive_rag_document_config_id=config_id
                    )
                    uow_ctx.naive_rag_storage.update_document_config_status(
                        naive_rag_document_config_id=config_id,
                        status="indexing",
                    )
            except ForeignKeyViolation:
                logger.warning(
                    f"Document: {file_name} was deleted before indexing started"
                )
                continue

            # Stage B: chunk + embed atomically per doc. Either everything for
            # this doc lands (chunks + embeddings + status=completed) or nothing
            # does (rollback) and we mark the doc failed in a separate tx.
            phase = "chunk"
            try:
                with uow.start() as uow_ctx:
                    chunk_data_list = (
                        ChunkDocumentService().process_chunk_document_in_session(
                            uow_ctx=uow_ctx,
                            naive_rag_document_config_id=config_id,
                        )
                    )

                    if not chunk_data_list:
                        logger.warning(
                            f"Document: {file_name} produced no chunks; marking warning"
                        )
                        uow_ctx.naive_rag_storage.update_document_config_status(
                            naive_rag_document_config_id=config_id,
                            status="warning",
                        )
                        continue

                    phase = "embed"
                    for chunk_data in chunk_data_list:
                        embedded_data = embedder.embed(chunk_data["text"])
                        if isinstance(embedded_data, dict):
                            vector = embedded_data.get("embedding", [])
                        else:
                            vector = embedded_data

                        uow_ctx.naive_rag_storage.save_embedding(
                            chunk_id=chunk_data["chunk_id"],
                            embedding=vector,
                            naive_rag_document_config_id=config_id,
                        )

                    uow_ctx.naive_rag_storage.update_document_config_status(
                        naive_rag_document_config_id=config_id,
                        status="completed",
                    )
                logger.success(f"Document: {file_name} embedded!")
            except ForeignKeyViolation:
                logger.warning(f"Document: {file_name} was deleted mid-processing")
                continue
            except Exception as e:
                if phase == "chunk":
                    code, message = _classify_chunking_error(e)
                else:
                    code, message = _classify_embedder_error(e)
                try:
                    with uow.start() as uow_ctx:
                        uow_ctx.naive_rag_storage.mark_document_config_failed(
                            naive_rag_document_config_id=config_id,
                            error_code=code,
                            error_message=message,
                        )
                except Exception as inner:
                    logger.error(
                        f"Could not persist failure for {file_name}, "
                        f"config {config_id}: {inner}"
                    )
                logger.error(
                    f"{phase.capitalize()}ing failed for {file_name}, "
                    f"config {config_id}: {e}"
                )
                continue

        self.update_naive_rag_status(naive_rag_id=naive_rag_id)
        logger.info(f"Embedding finished for naive_rag_id: {naive_rag_id}")

    def update_naive_rag_status(self, naive_rag_id: int):
        """
        Recompute NaiveRag.rag_status from document config statuses.

        Doc statuses: new, chunking, chunked, indexing, completed, warning, failed.
        RAG statuses: new, processing, completed, warning, failed.

        Rules (mirror of Django-side NaiveRag.update_rag_status):
        - empty / all `new`                                  -> new
        - any chunking/chunked/indexing                      -> processing
        - all completed                                      -> completed
        - all failed                                         -> failed
        - any mix (e.g. completed+failed, completed+new)     -> warning
        """
        IN_PROGRESS = {"chunking", "chunked", "indexing"}

        uow = UnitOfWork()
        with uow.start() as uow_ctx:
            doc_configs = uow_ctx.naive_rag_storage.get_naive_rag_document_configs(
                naive_rag_id=naive_rag_id
            )
            config_statuses = {config.status for config in doc_configs}

        if not config_statuses or config_statuses == {"new"}:
            current_status = "new"
        elif config_statuses & IN_PROGRESS:
            current_status = "processing"
        elif config_statuses == {"completed"}:
            current_status = "completed"
        elif config_statuses == {"failed"}:
            current_status = "failed"
        else:
            current_status = "warning"

        with uow.start() as uow_ctx:
            uow_ctx.naive_rag_storage.update_rag_status(
                naive_rag_id=naive_rag_id, status=current_status
            )
            logger.info(f"Status '{current_status}' was set to NaiveRag {naive_rag_id}")

    def _create_default_embedding_function(self):
        """Create default OpenAI embedder."""
        return OpenAIEmbedder(
            api_key=os.getenv("OPENAI_API_KEY"), model_name="text-embedding-3-small"
        )

    def _set_embedder_config(self, embedder_config):
        """
        Set the embedding configuration.

        Args:
            embedder_config: Dict with api_key, model_name, provider

        Returns:
            Embedder instance

        TODO: use litellm instead
        """
        try:
            provider = embedder_config["provider"].lower()
            provider_to_class = {
                "openai": OpenAIEmbedder,
                "gemini": GoogleGenAIEmbedder,
                "cohere": CohereEmbedder,
                "mistral": MistralEmbedder,
                "together_ai": TogetherAIEmbedder,
            }
            embedder_class = provider_to_class.get(provider)
            if embedder_class is None:
                raise ValueError(f"Embedder provider '{provider}' is not supported.")

            logger.info(f"Embedder class: {embedder_class.__name__}")

            return embedder_class(
                api_key=embedder_config["api_key"],
                model_name=embedder_config["model_name"],
            )
        except Exception as e:
            logger.info(
                f"Failed to set custom embedder. Using default embedder. Error: {e}"
            )
            return self._create_default_embedding_function()

    # ==================== Preview Chunking ====================

    def process_preview_chunking(
        self,
        document_config_id: int,
        cancellation_token: Optional["CancellationToken"] = None,
    ) -> int:
        """
        Perform preview chunking for a NaiveRag document config.

        Delegates to ChunkDocumentService for the actual chunking work.
        Cleanup of old preview chunks is handled inside ChunkDocumentService.

        Args:
            document_config_id: naive_rag_document_config_id
            cancellation_token: Optional token to check if job was cancelled

        Returns:
            Number of preview chunks created
        """
        return ChunkDocumentService().process_preview_chunking(
            naive_rag_document_config_id=document_config_id,
            cancellation_token=cancellation_token,
        )
