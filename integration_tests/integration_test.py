from time import sleep

import pytest

from utils.utils import *
from utils.knowledge_utils import *
import uuid
from loguru import logger

from utils.variables import MANAGER_URL


def test_create_and_run_session(graph_id):

    # TODO: create a function to ensure container is running
    sleep(1)  # sleep to make sure that predifined models uploaded
    # Run sessions
    session1 = run_session(
        graph_id=graph_id,
        variables={"user_id": 14, "secret_message": "hello, crew"},
    )
    logger.success(f"Session with id {session1} created, yay!")

    try:
        wait_for_results(session_id=session1)
    finally:
        delete_session(session_id=session1)


@pytest.mark.asyncio
async def test_knowledges(collection_id, redis_service):
    """Knowledges created in 'collection_id' fixture"""
    test_query = "What makes MYM different from other logistics platforms?"

    # Execute the knowledge search
    results = await knowledge_search(
        knowledge_collection_id=collection_id,
        query=test_query,
        redis_service=redis_service,
    )

    # Assertions
    assert results is not None
    assert isinstance(results, list)
    str_results = "\n".join(results)
    assert (
        "A secure and user-friendly platform designed for businesses of all sizes."
        in str_results
    )


@pytest.mark.skip
def test_get_tool_class_data():

    tool_list_response = requests.get(
        f"{MANAGER_URL}/tool/list", headers={"Host": rhost}
    )
    validate_response(response=tool_list_response)
    tool_alias_list = tool_list_response.json()["tool_list"]

    error_tools = []
    for tool_alias in tool_alias_list:
        tool_class_data_response = requests.get(
            f"{MANAGER_URL}/tool/{tool_alias}/class-data", headers={"Host": rhost}
        )
        try:
            validate_response(response=tool_class_data_response)
            tool_alias_list = tool_class_data_response.json()["classdata"]
            print(tool_alias)
        except HTTPError as e:
            error_tools.append(
                {"tool_alias": tool_alias, "message": tool_class_data_response.reason}
            )

    if error_tools:
        assert False, str(error_tools)
