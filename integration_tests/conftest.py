import pytest
import pytest_asyncio
import os

from loguru import logger

from utils.utils import (
    get_llm_model,
    create_config,
    create_wikipedia_crew,
    create_author_crew,
    create_user_crew,
    create_graph,
    create_crew_node,
    create_llm_node,
    create_start_node,
    create_hash_message_python_node,
    create_option_1_python_node,
    create_option_2_python_node,
    create_edge,
    create_user_name_conditional_edge,
    delete_graph,
    delete_config,
    delete_crew,
    set_openai_api_key_to_environment,
)
from utils.knowledge_utils import (
    get_embedder_model,
    get_or_create_embedder_config,
    create_source_collection,
    check_statuses_for_embedding_creation,
    knowledge_clean_up,
)
from services.redis_service import RedisService

# Constants
REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))


# Fixture for embedder configuration
@pytest.fixture
def embedder_config_id():
    """Set up embedder model and config."""
    embedder_model_id = get_embedder_model(name="text-embedding-3-small")
    config_id = get_or_create_embedder_config(embedder_model_id=embedder_model_id)
    return config_id


# Fixture for source collection
@pytest.fixture
def collection_id(embedder_config_id):
    """Create a source collection for testing."""
    try:
        collection_id = create_source_collection(embedder_config_id=embedder_config_id)
        logger.info(f"Knowledge collection created ID: {collection_id}")

        check_statuses_for_embedding_creation(
            collection_id=collection_id, max_timeout=25
        )
        logger.success(f"Knowledge collection embedded ID: {collection_id}")

        # Return the collection ID for the test to use
        yield collection_id

    finally:
        # Cleanup after the test even if error occured
        try:
            knowledge_clean_up(collection_id)
            logger.info(f"Knowledge collection deleted ID: {collection_id}")

        except Exception as e:
            logger.warning(f"Warning: Cleanup failed: {e}")


@pytest_asyncio.fixture
async def redis_service():
    """Create and connect Redis service."""
    service = RedisService(host=REDIS_HOST, port=REDIS_PORT)
    await service.connect()
    yield service
    if service.aioredis_client:
        await service.aioredis_client.aclose()


@pytest.fixture
def graph_id():
    """Create and clean up resources for full session testing."""
    try:
        set_openai_api_key_to_environment()

        llm_id = get_llm_model()

        config_id = create_config(llm_id=llm_id)
        config_id_2 = create_config(llm_id=llm_id)

        wikipedia_crew_id = create_wikipedia_crew(config_id)
        author_crew_id = create_author_crew(config_id_2)
        user_crew_id = create_user_crew(config_id)

        _graph_id = create_graph("Integration graph2")

        # Crew Nodes
        create_crew_node(
            crew_id=wikipedia_crew_id,
            node_name="wiki_crew_node",
            graph_id=_graph_id,
            input_map={},
            output_variable_path="variables",
        )
        create_crew_node(
            crew_id=author_crew_id,
            node_name="author_crew_node",
            graph_id=_graph_id,
            input_map={"user_id": "variables.user_name"},
            output_variable_path="variables.result",
        )
        create_crew_node(
            crew_id=user_crew_id,
            node_name="user_crew_node",
            graph_id=_graph_id,
            input_map={"user_id": "variables.user_id"},
            output_variable_path="variables",
        )

        # LLM Node
        create_llm_node(
            llm_config_id=config_id,
            node_name="llm_node1",
            graph_id=_graph_id,
            input_map={"query": "variables.query"},
            output_variable_path="variables",
        )

        # Other Nodes
        create_start_node(graph_id=_graph_id)
        create_hash_message_python_node(graph_id=_graph_id)
        create_option_1_python_node(graph_id=_graph_id)
        create_option_2_python_node(graph_id=_graph_id)

        # Edges
        create_edge(start_key="__start__", end_key="hash_message", graph=_graph_id)
        create_edge(
            start_key="hash_message",
            end_key="user_crew_node",
            graph=_graph_id,
        )
        create_user_name_conditional_edge(source="user_crew_node", graph=_graph_id)
        create_edge(start_key="option_1", end_key="llm_node1", graph=_graph_id)
        create_edge(start_key="option_2", end_key="author_crew_node", graph=_graph_id)
        create_edge(
            start_key="author_crew_node",
            end_key="wiki_crew_node",
            graph=_graph_id,
        )

        logger.success("All integration resources created successfully.")
        yield _graph_id

    finally:
        try:
            logger.info("Start cleanup process")

            if _graph_id:
                delete_graph(_graph_id)
            if wikipedia_crew_id:
                delete_crew(wikipedia_crew_id)
            if author_crew_id:
                delete_crew(author_crew_id)
            if user_crew_id:
                delete_crew(user_crew_id)
            if config_id:
                delete_config(config_id)
            if config_id_2:
                delete_config(config_id_2)

        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")
        else:
            logger.success("Cleanup finished")
