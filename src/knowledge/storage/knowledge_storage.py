from typing import Dict, Optional, List
from sqlalchemy.orm import joinedload
from sqlalchemy import delete, select
from loguru import logger
from sqlalchemy import func
from .base_storage import BaseORMStorage
from models.orm.document_models import (
    BM25Index,
    DocumentEmbedding,
    EmbeddingModel,
    Provider,
    SourceCollection,
    EmbeddingConfig,
    DocumentMetadata,
    Chunk,
)
from models.enums import *
from sqlalchemy.orm import Session


class ORMKnowledgeStorage(BaseORMStorage):

    def save_embedding(
        self,
        chunk_id: int,
        embedding: list[float],
        document_id: int,
        collection_id: int,
    ) -> None:
        """Insert a new embedding using ORM."""
        try:
            embedding_obj = DocumentEmbedding(
                chunk_id=chunk_id,
                vector=embedding,
                document_id=document_id,
                collection_id=collection_id,
            )
            self.session.add(embedding_obj)
        except Exception as e:
            logger.error(f"Failed to save embedding: {e}")
            raise
    
    def delete_document_embeddings(self, document_id: int) -> None:
        stmt = delete(DocumentEmbedding).where(DocumentEmbedding.document_id == document_id)
        self.session.execute(stmt)

        
    def update_collection_status(self, status: Status, collection_id: int) -> bool:
        """Update the status of a collection."""
        if status not in Status:
            logger.error(f"Trying to set an invalid status: {status}")
            return False

        try:
            collection = self.session.get(SourceCollection, collection_id)
            if not collection:
                logger.warning(f"Collection {collection_id} not found")
                return False
            collection.status = status
            return True
        except Exception as e:
            logger.error(f"Failed to update collection {collection_id}: {e}")
            return False

    def get_embedder_configuration(
        self, collection_id: int
    ) -> Dict[str, Optional[str]]:
        """Get embedding configuration for a collection."""
        try:
            collection = (
                self.session.query(SourceCollection)
                .options(joinedload(SourceCollection.embedder))
                .filter(SourceCollection.collection_id == collection_id)
                .one_or_none()
            )
            if collection is None:
                raise ValueError(
                    f"Collection with collection_id={collection_id} was not found"
                )
            if collection.embedder is None:
                raise ValueError(
                    f"No embedding model found for collection_id={collection_id}"
                )

            embedder: EmbeddingConfig = collection.embedder
            model: EmbeddingModel = embedder.model
            embedding_provider: Provider = model.embedding_provider
            return {
                "api_key": getattr(embedder, "api_key", None),
                "model_name": model.name,
                "provider": embedding_provider.name,
            }
        except Exception as e:
            logger.error(
                f"Failed to get embedder configuration for {collection_id}: {e}"
            )
            raise

    def vector_search( # <-- ПЕРЕИМЕНОВАНО И ИЗМЕНЕНО
        self,
        embedded_query: List[float],
        collection_id: int,
        limit: int = 10, # Увеличим лимит для RRF
        similarity_threshold: float = 0.2,
    ) -> list[tuple[int, float]]: # <-- ИЗМЕНЕН ТИП ВОЗВРАТА
        """
        Search documents using vector similarity.
        Returns list of (chunk_id, similarity_score).
        """
        try:
            # 1. Вычисляем сходство (1 - cosine_distance)
            similarity_expr = (1 - DocumentEmbedding.vector.cosine_distance(embedded_query)).label("similarity")

            stmt = (
                select(DocumentEmbedding.chunk_id, similarity_expr)
                .join(Chunk, Chunk.id == DocumentEmbedding.chunk_id)
                .where(DocumentEmbedding.collection_id == collection_id)
                .where(similarity_expr >= similarity_threshold)
                .order_by(similarity_expr.desc())
                .limit(limit)
            )

            results = self.session.execute(stmt).all()
            
            return [(r.chunk_id, r.similarity) for r in results]

        except Exception as e:
            logger.error(f"Vector Search failed for collection {collection_id}: {e}")
            return []


    def save_bm25_index(self, collection_id: int, index_data: bytes) -> bool:
        try:
            existing_index = (
                self.session.query(BM25Index)
                .filter(BM25Index.collection_id == collection_id)
                .one_or_none()
            )
            
            if existing_index:
                existing_index.index_data = index_data
                existing_index.created_at = func.now()
            else:
                new_index = BM25Index(
                    collection_id=collection_id, index_data=index_data
                )
                self.session.add(new_index)
                
            return True
        except Exception as e:
            self.session.rollback() # Откатываем в случае ошибки
            logger.error(f"Failed to save BM25 index for collection {collection_id}: {e}")
            return False

    def load_bm25_index(self, collection_id: int) -> Optional[bytes]:
        """Загружает сериализованный индекс BM25 из БД."""
        try:
            index = (
                self.session.query(BM25Index.index_data)
                .filter(BM25Index.collection_id == collection_id)
                .one_or_none()
            )
            return index[0] if index else None
        except Exception as e:
            logger.error(f"Failed to load BM25 index for collection {collection_id}: {e}")
            return None
