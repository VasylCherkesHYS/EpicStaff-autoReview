import pytest
import pytest_asyncio
import os
import requests

from loguru import logger

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
DJANGO_URL = "http://127.0.0.1:8000/api"


@pytest.fixture(scope="session")
def auth_token():

    # Get token from the API
    response = requests.post(
        f"{DJANGO_URL}/login/",
        data={"username": "testuser_1", "password": "testuser_password"},
    )

    # Return the access token
    return response.json()["access"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# Fixture for embedder configuration
@pytest.fixture
def embedder_config_id(auth_headers):
    """Set up embedder model and config."""
    embedder_model_id = get_embedder_model(auth_headers, name="text-embedding-3-small")
    config_id = get_or_create_embedder_config(
        auth_headers, embedder_model_id=embedder_model_id
    )
    return config_id


# Fixture for source collection
@pytest.fixture
def collection_id(auth_headers, embedder_config_id):
    """Create a source collection for testing."""
    collection_id = create_source_collection(
        auth_headers, embedder_config_id=embedder_config_id
    )
    logger.info(f"Knowledge collection created ID: {collection_id}")

    check_statuses_for_embedding_creation(
        auth_headers, collection_id=collection_id, max_timeout=25
    )
    logger.success(f"Knowledge collection embedded ID: {collection_id}")

    # Return the collection ID for the test to use
    yield collection_id

    # Cleanup after the test
    try:
        knowledge_clean_up(auth_headers, collection_id)
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
