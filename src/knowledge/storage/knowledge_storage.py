from typing import Dict, Optional, List
from sqlalchemy.orm import joinedload
from sqlalchemy import select
from loguru import logger

from .base_storage import BaseORMStorage
from models.orm.document_models import (
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

    def search(
        self,
        embedded_query: List[float],
        collection_id: int,
        limit: int = 3,
        distance_threshold: float = 0.6,
    ) -> List[str]:
        """Search documents using vector similarity."""
        try:
            stmt = (
                select(
                    Chunk.text,
                    DocumentEmbedding.vector.cosine_distance(embedded_query).label(
                        "distance"
                    ),
                )
                .join(Chunk, Chunk.id == DocumentEmbedding.chunk_id)
                .where(DocumentEmbedding.collection_id == collection_id)
                .order_by("distance")
                .limit(limit)
            )

            results = self.session.execute(stmt).all()

            return [
                r.text
                for r in results
                if r.distance is not None and float(r.distance) < distance_threshold
            ]

        except Exception as e:
            logger.error(f"Search failed for collection {collection_id}: {e}")
            return []
