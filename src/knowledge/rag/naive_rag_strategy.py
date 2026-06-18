import os
import threading
from collections import defaultdict
from typing import Optional
from loguru import logger
import cachetools

from services.cancellation_token import CancellationToken

from psycopg2.errors import ForeignKeyViolation
from sqlalchemy.orm.exc import StaleDataError

_DOC_VANISHED_ERRORS = (ForeignKeyViolation, StaleDataError)

from src.shared.models import (
    NaiveRagSearchConfig,
    BaseKnowledgeSearchMessageResponse,
    compute_rag_status,
    summarize_rag_error,
)
from rag.base_rag_strategy import BaseRAGStrategy
from services.chunk_document_service import ChunkDocumentService
from settings import UnitOfWork
from embedder.openai import OpenAIEmbedder
from embedder.gemini import GoogleGenAIEmbedder
from embedder.cohere import CohereEmbedder
from embedder.mistral import MistralEmbedder
from embedder.together_ai import TogetherAIEmbedder
from utils.indexing_error_classifier import IndexingErrorClassifier


_embedder_cache = cachetools.LRUCache(maxsize=50)

_doc_index_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)


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

        embedded_data = embedder.embed(query)

        if isinstance(embedded_data, dict):
            embedded_query = embedded_data.get("embedding", [])
            token_usage = embedded_data.get("token_usage")
        else:
            embedded_query = embedded_data

        uow = UnitOfWork()
        with uow.start() as uow_ctx:
            knowledge_chunk_list = uow_ctx.naive_rag_storage.search(
                naive_rag_id=naive_rag_id,
                embedded_query=embedded_query,
                limit=search_limit,
                similarity_threshold=similarity_threshold,
            )

            knowledge_snippets = []
            for chunk_data in knowledge_chunk_list:
                knowledge_snippets.append(chunk_data.chunk_text)

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
        """Chunk+embed for a NaiveRag. `document_config_ids` (if set) is the
        vetted list from IndexingService; otherwise pick up everything not
        already completed (legacy whole-RAG path)."""
        naive_rag_id = rag_id
        _embedder_cache.pop(naive_rag_id, None)
        embedder = self._get_cached_embedder(naive_rag_id=naive_rag_id)
        uow = UnitOfWork()

        with uow.start() as ctx:
            ctx.naive_rag_storage.update_rag_status(
                naive_rag_id=naive_rag_id, status="processing"
            )
        logger.info(
            f"Processing naive_rag_id={naive_rag_id}, "
            f"document_config_ids={document_config_ids or 'all'}"
        )

        try:
            work_items = self._resolve_work_items(
                uow, naive_rag_id, document_config_ids
            )
        except Exception as e:
            with uow.start() as ctx:
                ctx.naive_rag_storage.update_rag_status(
                    naive_rag_id=naive_rag_id, status="failed"
                )
            logger.error(f"Failed to load configs for naive_rag {naive_rag_id}: {e}")
            return

        if not work_items:
            logger.warning(f"NaiveRag {naive_rag_id}: nothing to (re)index")

        for config_id, file_name in work_items:
            logger.info(f"Processing {file_name} (config {config_id})")
            with _doc_index_locks[config_id]:
                if self._already_indexed(uow, config_id):
                    logger.info(
                        f"{file_name} (config {config_id}): already up to date "
                        f"(indexed by a concurrent job), skipping"
                    )
                    continue
                if self._prepare_doc_for_indexing(uow, config_id, file_name):
                    self._chunk_and_embed_doc(uow, config_id, file_name, embedder)

        self.update_naive_rag_status(naive_rag_id=naive_rag_id)
        logger.info(f"Embedding finished for naive_rag_id={naive_rag_id}")

    def _already_indexed(self, uow, config_id) -> bool:
        """Re-check under the per-doc lock: a concurrent job we just waited on
        may have finished this document with identical params. Re-indexing would
        waste embedder calls, so skip when snapshot is current and completed."""
        with uow.start() as ctx:
            c = ctx.naive_rag_storage.get_naive_rag_document_config_by_id(config_id)
            return c is not None and c.status == "completed" and c.is_snapshot_current()

    def _resolve_work_items(self, uow, naive_rag_id, document_config_ids):
        """Read-only tx → list[(config_id, file_name)]. Detaches to plain
        tuples so per-doc txs don't share a long-lived session."""
        with uow.start() as ctx:
            if document_config_ids:
                raw = [
                    ctx.naive_rag_storage.get_naive_rag_document_config_by_id(cid)
                    for cid in document_config_ids
                ]
                return [
                    (c.naive_rag_document_id, c.document.file_name)
                    for c in raw
                    if c is not None and c.naive_rag_id == naive_rag_id
                ]
            raw = ctx.naive_rag_storage.get_naive_rag_document_configs(
                naive_rag_id=naive_rag_id,
                status=("new", "warning", "chunked", "failed", "indexing"),
            )
            return [(c.naive_rag_document_id, c.document.file_name) for c in raw]

    def _prepare_doc_for_indexing(self, uow, config_id, file_name) -> bool:
        """Wipe stale artifacts and flip status=indexing in its own tx so the
        UI sees the transition. Returns False if the doc was deleted."""
        try:
            with uow.start() as ctx:
                s = ctx.naive_rag_storage
                s.delete_embeddings(naive_rag_document_config_id=config_id)
                s.delete_chunks(naive_rag_document_config_id=config_id)
                s.clear_indexed_snapshot(naive_rag_document_config_id=config_id)
                try:
                    s.delete_preview_chunks(naive_rag_document_config_id=config_id)
                except Exception:
                    pass
                s.clear_document_config_error(naive_rag_document_config_id=config_id)
                s.update_document_config_status(
                    naive_rag_document_config_id=config_id, status="indexing"
                )
            return True
        except _DOC_VANISHED_ERRORS:
            logger.warning(f"Document {file_name}: deleted before indexing")
            return False

    def _chunk_and_embed_doc(self, uow, config_id, file_name, embedder) -> None:
        """Chunk + embed atomically. On error, classify and persist via mark_failed
        in a separate tx so the failure write isn't rolled back."""
        phase = "chunk"
        try:
            with uow.start() as ctx:
                chunks = ChunkDocumentService().process_chunk_document_in_session(
                    uow_ctx=ctx, naive_rag_document_config_id=config_id
                )
                if not chunks:
                    logger.warning(f"Document {file_name}: 0 chunks, marking warning")
                    if not ctx.naive_rag_storage.update_document_config_status(
                        naive_rag_document_config_id=config_id, status="warning"
                    ):
                        logger.error(
                            f"Document {file_name}/{config_id}: could not set 'warning' "
                            f"status (config missing?)"
                        )
                    return

                phase = "embed"
                for c in chunks:
                    embedded = embedder.embed(c["text"])
                    vec = (
                        embedded.get("embedding", [])
                        if isinstance(embedded, dict)
                        else embedded
                    )
                    ctx.naive_rag_storage.save_embedding(
                        chunk_id=c["chunk_id"],
                        embedding=vec,
                        naive_rag_document_config_id=config_id,
                    )
                if not ctx.naive_rag_storage.mark_document_config_completed(
                    naive_rag_document_config_id=config_id,
                ):
                    raise RuntimeError(
                        f"Failed to mark config {config_id} completed after embedding"
                    )
            logger.success(f"Document {file_name}: embedded")
        except _DOC_VANISHED_ERRORS:
            logger.warning(f"Document {file_name}: deleted mid-processing")
        except Exception as e:
            self._persist_doc_failure(uow, config_id, file_name, phase, e)

    def _persist_doc_failure(self, uow, config_id, file_name, phase, exc) -> None:
        classify = (
            IndexingErrorClassifier.for_chunking
            if phase == "chunk"
            else IndexingErrorClassifier.for_embedding
        )
        code, message = classify(exc)
        persisted = False
        try:
            with uow.start() as ctx:
                persisted = ctx.naive_rag_storage.mark_document_config_failed(
                    naive_rag_document_config_id=config_id,
                    error_code=code,
                    error_message=message,
                )
        except Exception as inner:
            logger.error(
                f"Could not persist failure for {file_name}/{config_id}: {inner}"
            )

        if not persisted:
            try:
                with uow.start() as ctx:
                    ctx.naive_rag_storage.update_document_config_status(
                        naive_rag_document_config_id=config_id, status="failed"
                    )
            except Exception as inner2:
                logger.error(
                    f"Fallback status flip failed for {file_name}/{config_id}: {inner2}"
                )
        logger.error(f"{phase}ing failed for {file_name}/{config_id}: {message}")

    def update_naive_rag_status(self, naive_rag_id: int):
        """Recompute NaiveRag.rag_status from per-doc statuses using the shared
        single-source rule (src.shared.models.knowledge_status.compute_rag_status)."""
        uow = UnitOfWork()
        with uow.start() as ctx:
            statuses = [
                c.status
                for c in ctx.naive_rag_storage.get_naive_rag_document_configs(
                    naive_rag_id=naive_rag_id
                )
            ]

        new_status = compute_rag_status(statuses)
        error_summary = summarize_rag_error(statuses)

        with uow.start() as ctx:
            ctx.naive_rag_storage.update_rag_status(
                naive_rag_id=naive_rag_id, status=new_status
            )
            ctx.naive_rag_storage.set_error_message(naive_rag_id, error_summary)
            if new_status == "completed":
                ctx.naive_rag_storage.set_indexed_at(naive_rag_id)
            logger.info(f"NaiveRag {naive_rag_id} -> status '{new_status}'")

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
