from typing import Dict, Any, List, Optional
from django.db import transaction
from django.utils import timezone
from loguru import logger

from tables.models.knowledge_models import (
    NaiveRag,
    NaiveRagDocumentConfig,
    DocumentMetadata,
    GraphRag,
    GraphRagDocument,
    SourceCollection,
)
from tables.exceptions import (
    NaiveRagNotFoundException,
    GraphRagNotFoundException,
    CollectionNotFoundException,
    DocumentsNotFoundException,
    RagException,
    RagNotReadyForIndexingException,
)


class IndexingService:
    """Validates and partitions RAG configurations for an indexing run."""

    @staticmethod
    @transaction.atomic
    def validate_and_prepare_indexing(
        rag_id: int,
        rag_type: str,
        document_config_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        if rag_type == "naive":
            return IndexingService._prepare_naive_rag_indexing(
                rag_id, document_config_ids
            )
        if rag_type == "graph":
            return IndexingService._prepare_graph_rag_indexing(rag_id)
        raise RagException(f"Unknown rag_type: {rag_type}")

    @staticmethod
    def _prepare_naive_rag_indexing(
        naive_rag_id: int,
        document_config_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Partition configs into accepted / skipped_completed / skipped_in_progress.
        Configs whose live params match the indexed_* snapshot are flipped to
        COMPLETED here (no worker dispatch); in-progress configs are left alone."""
        try:
            naive_rag = NaiveRag.objects.select_related(
                "base_rag_type", "base_rag_type__source_collection", "embedder"
            ).get(naive_rag_id=naive_rag_id)
        except NaiveRag.DoesNotExist:
            raise NaiveRagNotFoundException(naive_rag_id)

        base_rag_type = naive_rag.base_rag_type
        collection = base_rag_type.source_collection
        if not collection:
            raise CollectionNotFoundException(
                f"Collection not found for BaseRagType {base_rag_type.rag_type_id}"
            )
        if not naive_rag.embedder:
            raise RagNotReadyForIndexingException(
                f"NaiveRag {naive_rag_id} has no embedder configured."
            )

        configs = IndexingService._resolve_naive_configs(
            naive_rag_id, collection, document_config_ids
        )

        DocStatus = NaiveRagDocumentConfig.NaiveRagDocumentStatus
        accepted, skipped_completed, skipped_in_progress = [], [], []
        status_changed = False

        for c in configs:
            cid = c.naive_rag_document_id
            if c.status in NaiveRagDocumentConfig.IN_PROGRESS_STATUSES:
                skipped_in_progress.append(cid)
            elif c.is_snapshot_current():
                if c.status != DocStatus.COMPLETED:
                    IndexingService._mark_snapshot_completed(c)
                    status_changed = True
                skipped_completed.append(cid)
            else:
                accepted.append(cid)

        if accepted:
            NaiveRagDocumentConfig.objects.filter(
                naive_rag_document_id__in=accepted
            ).update(
                status=DocStatus.INDEXING,
                error_message=None,
                error_code=NaiveRagDocumentConfig.DocumentErrorCode.NONE,
                failed_at=None,
            )
            status_changed = True

        if status_changed:
            naive_rag.update_rag_status()

        logger.info(
            f"Prepared NaiveRag {naive_rag_id}: collection={collection.collection_id}, "
            f"embedder={naive_rag.embedder.id}, accepted={accepted}, "
            f"skipped_completed={skipped_completed}, skipped_in_progress={skipped_in_progress}"
        )

        return {
            "rag_id": naive_rag_id,
            "rag_type": "naive",
            "collection_id": collection.collection_id,
            "base_rag_type_id": base_rag_type.rag_type_id,
            "accepted_config_ids": accepted,
            "skipped_completed_config_ids": skipped_completed,
            "skipped_in_progress_config_ids": skipped_in_progress,
        }

    @staticmethod
    def _resolve_naive_configs(
        naive_rag_id: int,
        collection: SourceCollection,
        document_config_ids: Optional[List[int]],
    ) -> List[NaiveRagDocumentConfig]:
        if document_config_ids:
            configs = list(
                NaiveRagDocumentConfig.objects.filter(
                    naive_rag_id=naive_rag_id,
                    naive_rag_document_id__in=document_config_ids,
                )
            )
            found = {c.naive_rag_document_id for c in configs}
            missing = [cid for cid in document_config_ids if cid not in found]
            if missing:
                raise RagException(
                    f"Document configs do not belong to NaiveRag {naive_rag_id}: {missing}"
                )
            order = {cid: i for i, cid in enumerate(document_config_ids)}
            configs.sort(key=lambda c: order[c.naive_rag_document_id])
            return configs

        if not DocumentMetadata.objects.filter(source_collection=collection).exists():
            raise DocumentsNotFoundException(
                f"Collection {collection.collection_id} has no documents to index"
            )
        return list(NaiveRagDocumentConfig.objects.filter(naive_rag_id=naive_rag_id))

    @staticmethod
    def _mark_snapshot_completed(c: NaiveRagDocumentConfig) -> None:
        c.status = NaiveRagDocumentConfig.NaiveRagDocumentStatus.COMPLETED
        c._clear_error()
        c.processed_at = timezone.now()
        c.save(
            update_fields=[
                "status",
                "error_message",
                "error_code",
                "failed_at",
                "processed_at",
            ]
        )

    @staticmethod
    def _prepare_graph_rag_indexing(graph_rag_id: int) -> Dict[str, Any]:
        try:
            graph_rag = GraphRag.objects.select_related(
                "base_rag_type",
                "base_rag_type__source_collection",
                "embedder",
                "llm",
                "index_config",
            ).get(graph_rag_id=graph_rag_id)
        except GraphRag.DoesNotExist:
            raise GraphRagNotFoundException(graph_rag_id)

        base_rag_type = graph_rag.base_rag_type
        collection = base_rag_type.source_collection
        if not collection:
            raise CollectionNotFoundException(
                f"Collection not found for BaseRagType {base_rag_type.rag_type_id}"
            )

        has_documents = GraphRagDocument.objects.filter(graph_rag=graph_rag).exists()
        requirements = (
            (has_documents, "has no documents"),
            (graph_rag.embedder, "has no embedder configured"),
            (graph_rag.llm, "has no LLM configured"),
            (graph_rag.index_config, "has no index configuration"),
        )
        for present, message in requirements:
            if not present:
                raise RagNotReadyForIndexingException(
                    f"GraphRag {graph_rag_id} {message}."
                )

        logger.info(
            f"Prepared GraphRag {graph_rag_id}: collection={collection.collection_id}, "
            f"embedder={graph_rag.embedder.id}, llm={graph_rag.llm.id}"
        )
        return {
            "rag_id": graph_rag_id,
            "rag_type": "graph",
            "collection_id": collection.collection_id,
            "base_rag_type_id": base_rag_type.rag_type_id,
        }

    @staticmethod
    def mark_indexing_dispatched(rag_id: int, rag_type: str) -> None:
        """Flag the RAG PROCESSING the moment work is dispatched, so polling
        clients don't see the stale pre-dispatch status. Direct .update(), no
        status recompute. Naive is already flipped to PROCESSING atomically in
        _prepare_naive_rag_indexing (before the publish), so only graph needs it."""
        if rag_type == "graph":
            GraphRag.objects.filter(graph_rag_id=rag_id).update(
                rag_status=GraphRag.GraphRagStatus.PROCESSING
            )

    @staticmethod
    def get_rag_status(rag_id: int, rag_type: str) -> str:
        if rag_type == "naive":
            try:
                return NaiveRag.objects.get(naive_rag_id=rag_id).rag_status
            except NaiveRag.DoesNotExist:
                raise NaiveRagNotFoundException(rag_id)
        if rag_type == "graph":
            try:
                return GraphRag.objects.get(graph_rag_id=rag_id).rag_status
            except GraphRag.DoesNotExist:
                raise GraphRagNotFoundException(rag_id)
        raise RagException(f"Unknown rag_type: {rag_type}")
