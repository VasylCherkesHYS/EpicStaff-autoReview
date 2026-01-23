from rag.rag_strategy_factory import RAGStrategyFactory
from rag.base_rag_strategy import BaseRAGStrategy
from settings import UnitOfWork
from embedder.openai import OpenAIEmbedder
from embedder.gemini import GoogleGenAIEmbedder
from embedder.cohere import CohereEmbedder
from embedder.mistral import MistralEmbedder
from embedder.together_ai import TogetherAIEmbedder
from embedder.custom_embedder import CustomEmbedder
from models.enums import *
from utils.singleton_meta import SingletonMeta
from models.redis_models import BaseRagSearchConfig


class CollectionProcessorService(metaclass=SingletonMeta):
    """Context class that uses a RAG strategy."""

    def __init__(self):
        self.uow = UnitOfWork()

    def _get_strategy(self, rag_type: str) -> BaseRAGStrategy:
        return RAGStrategyFactory.get_strategy(rag_type)

    def process_rag_indexing(self, rag_id: int, rag_type: str):
        strategy = self._get_strategy(rag_type)
        strategy.process_rag_indexing(rag_id=rag_id)

    def search(
        self,
        rag_id: int,
        rag_type: str,
        collection_id: int,
        uuid: str,
        query: str,
        rag_search_config: BaseRagSearchConfig,
    ):
        strategy = self._get_strategy(rag_type)
        return strategy.search(
            rag_id=rag_id,
            collection_id=collection_id,
            uuid=uuid,
            query=query,
            rag_search_config=rag_search_config,
        )

    # TODO: use litellm instead
    def _set_embedder_config(self, embedder_config) -> None:
        """Set the embedding configuration for the knowledge storage."""

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
                logger.info(f"Using CustomEmbedder for provider '{provider}'")
                return CustomEmbedder(
                    api_key=embedder_config["api_key"],
                    model_name=embedder_config["model_name"],
                    base_url=embedder_config.get("base_url"),
                )

            logger.info(f"Embedder class: {embedder_class.__name__}")
            return embedder_class(
                api_key=embedder_config["api_key"],
                model_name=embedder_config["model_name"],
            )
        except Exception as e:
            logger.error(
                f"Failed to set custom embedder. Default embedder setted. Error: {e}"
            )
            return self._create_default_embedding_function()

    def process_collection_status(self, collection_id):
        """
        Update Collection status based on documents statuses

        FAILED: all documents Failed
        WARNING: at least 1 Warning or 1 Failed (but not all Failed),
                or mixture with CHUNKED
        PROCESSING: at least 1 Processing
        NEW: all documents are New OR no documents
        COMPLETED: all documents are Completed
        CHUNKED: all documents are Chunked
        """
        uow = UnitOfWork()
        with uow.start() as uow_ctx:
            documents_statuses = set(
                uow.document_storage.get_documents_statuses(collection_id)
            )

        if not documents_statuses or documents_statuses == {Status.NEW}:
            current_status = Status.NEW
        elif documents_statuses == {Status.COMPLETED}:
            current_status = Status.COMPLETED
        elif documents_statuses == {Status.FAILED}:
            current_status = Status.FAILED
        elif documents_statuses == {Status.CHUNKED}:
            current_status = Status.CHUNKED
        elif Status.PROCESSING in documents_statuses:
            current_status = Status.PROCESSING
        elif (
            Status.FAILED in documents_statuses
            or Status.WARNING in documents_statuses
            or Status.CHUNKED in documents_statuses
        ):
            current_status = Status.WARNING
        else:
            # fallback
            current_status = Status.WARNING

        with uow.start() as uow_ctx:
            uow_ctx.knowledge_storage.update_collection_status(
                current_status, collection_id
            )
            logger.info(f"{current_status} was set to collection {collection_id}")
