import json
import os
import subprocess
import sys
import random
import uuid
from typing import Any
from requests import HTTPError, Response
import requests
import time
import dotenv
import docker
from loguru import logger

from utils.variables import DJANGO_URL, rhost

dotenv.load_dotenv()

MAX_SESSION_EXECUTION_TIME_SECONDS = 1200
container_name_list = [
    "manager_container",
    "redis",
    "crewdb",
    "django_app",
    "crew",
    "sandbox",
    "knowledge",
]  #  "frontend"

logger.remove()
logger.add(sink=sys.stdout, level="DEBUG")


def _get_docker_host_from_context() -> str | None:
    """Fetch Docker host from the current context."""
    try:
        result = subprocess.run(
            ["docker", "context", "inspect"],
            capture_output=True,
            check=True,
            text=True,
        )
        contexts = json.loads(result.stdout)
        if contexts and isinstance(contexts, list):
            docker_host = contexts[0]["Endpoints"]["docker"]["Host"]
            return docker_host
    except (
        subprocess.CalledProcessError,
        KeyError,
        IndexError,
        json.JSONDecodeError,
    ):
        return None


client = docker.DockerClient(base_url=_get_docker_host_from_context())


def is_container_running(container_name: str) -> bool:
    """
    Checks if a Docker container is alive (running) by its name or ID.

    Args:
        container_name (str): The name or ID of the Docker container.

    Returns:
        bool: True if the container is running, False otherwise.
    """

    try:
        container = client.containers.get(container_name)
        # Check if the container status is 'running'
        return container.status == "running"
    except docker.errors.NotFound:
        logger.error(f"Container '{container_name}' not found.")
        log_container(container_name=container_name)
        return False
    except docker.errors.APIError as e:
        logger.error(f"Error connecting to Docker API: {e}")
        return False


def validate_task_and_session(task_name, task_id, agent_id, session_id):
    task_response = requests.get(
        f"{DJANGO_URL}/task-messages/?session_id={session_id}", headers={"Host": rhost}
    )
    validate_response(task_response)
    task_message = task_response.json()

    agent_response = requests.get(
        f"{DJANGO_URL}/agent-messages/?session_id={session_id}", headers={"Host": rhost}
    )
    validate_response(agent_response)
    agent_message = agent_response.json()

    assert agent_message["results"][0]["agent"] == agent_id, "Agent ID mismatch"
    assert task_message["results"][0]["task"] == task_id, "Task ID mismatch"
    assert task_message["results"][0]["name"] == task_name, "Task name mismatch"

    session_response = requests.get(
        f"{DJANGO_URL}/sessions/{session_id}/", headers={"Host": rhost}
    )
    validate_response(session_response)
    session_data = session_response.json()

    assert (
        session_data["crew_schema"]["tasks"][0]["name"] == task_name
    ), "Session task name mismatch"


def wait_for_results(session_id: int):
    start_time = time.time()
    while True:
        if time.time() - start_time > MAX_SESSION_EXECUTION_TIME_SECONDS:
            raise TimeoutError()
        check_containers()
        status = get_session_status(session_id=session_id)

        if status == "error":
            logger.error(f"Session status is {status}")
            for container_name in container_name_list:
                log_container(container_name)

            assert False, f"Session status is {status}"

        if status == "end":
            break

        time.sleep(2)
    session_message_list = get_graph_session_messages(session_id=session_id)
    logger.info(f"Messages: \n{session_message_list}")
    assert len(session_message_list) != 0


def delete_session(session_id: int):
    get_url = f"{DJANGO_URL}/sessions/{session_id}"
    delete_url = f"{DJANGO_URL}/sessions/{session_id}/"

    response = requests.get(get_url, headers={"Host": rhost})
    validate_response(response)
    assert response.status_code == 200
    assert response.json()["id"] == session_id

    response = requests.delete(delete_url, headers={"Host": rhost})
    assert response.status_code == 204
    assert not response.content

    response = requests.get(get_url, headers={"Host": rhost})
    assert response.status_code == 404

    logger.info(f"Session {session_id} deleted")


def validate_response(response: Response) -> None:
    try:
        response.raise_for_status()
    except HTTPError as e:
        logger.error(response.content)
        raise


def log_container(container_name: str):
    container = client.containers.get(container_name)
    logs = container.logs(timestamps=True).decode("utf-8")

    logger.info(f"{container_name} logs\n{logs}")


def check_containers():
    for name in container_name_list:
        running = is_container_running(container_name=name)
        if not running:
            logger.error(f'Container "{name}" not running')
            assert False, f'Container "{name}" not running'


def get_graph_session_messages(session_id: int) -> list:
    session_response = requests.get(
        f"{DJANGO_URL}/graph-session-messages/?session_id={session_id}",
        headers={"Host": rhost},
    )
    validate_response(session_response)
    return session_response.json()["results"]


def get_session_status(session_id: int) -> str:
    session_response = requests.get(
        f"{DJANGO_URL}/sessions/{session_id}/", headers={"Host": rhost}
    )
    validate_response(session_response)

    return session_response.json()["status"]


def run_session(graph_id: int, variables: dict | None = None):
    if variables is None:
        variables = dict()

    run_data = {
        "graph_id": graph_id,
        "variables": variables,
    }
    run_crew_response = requests.post(
        f"{DJANGO_URL}/run-session/", json=run_data, headers={"Host": rhost}
    )
    validate_response(run_crew_response)
    return run_crew_response.json()["session_id"]


def create_tool_config(*args, **kwargs) -> int:

    tool_config_response = requests.post(
        f"{DJANGO_URL}/tool-configs/", json=kwargs, headers={"Host": rhost}
    )
    validate_response(tool_config_response)
    return tool_config_response.json()["id"]


def create_task(*args, **kwargs) -> tuple:
    tasks_response = requests.post(
        f"{DJANGO_URL}/tasks/", json=kwargs, headers={"Host": rhost}
    )
    validate_response(tasks_response)

    return tasks_response.json()["id"], tasks_response.json()["name"]


def create_crew(*args, **kwargs) -> int:
    crew_response = requests.post(
        f"{DJANGO_URL}/crews/", json=kwargs, headers={"Host": rhost}
    )
    validate_response(crew_response)
    return crew_response.json()["id"]


def create_agent(*args, **kwargs) -> int:
    kwargs["configured_tools"] = kwargs.get("configured_tools") or []
    kwargs["python_code_tools"] = kwargs.get("python_code_tools") or []

    agent_response = requests.post(
        f"{DJANGO_URL}/agents/", json=kwargs, headers={"Host": rhost}
    )
    validate_response(agent_response)

    return agent_response.json()["id"]


def create_config(llm_id: int) -> int:
    llm_config_data = {
        "custom_name": "MyLLMConfig",
        "model": llm_id,
        "temperature": 0,
    }

    llm_config_response = requests.get(
        f"{DJANGO_URL}/llm-configs?custom_name={llm_config_data['custom_name']}",
        headers={"Host": rhost},
    )
    llm_config = None
    if llm_config_response.ok:
        results = llm_config_response.json()["results"]
        if len(results) > 0:
            llm_config = results[0]

    if llm_config is None:
        llm_config_response = requests.post(
            f"{DJANGO_URL}/llm-configs/", json=llm_config_data, headers={"Host": rhost}
        )
        validate_response(llm_config_response)
        llm_config = llm_config_response.json()

    return llm_config["id"]


def set_openai_api_key_to_environment() -> None:
    OPENAI_API_KEY = os.environ.get("OPENAI_KEY", None)

    if OPENAI_API_KEY is None:

        logger.error("OPENAI_KEY not provided")
        assert False, "OPENAI_KEY not provided"

    environment_data = {"data": {"OPENAI_API_KEY": OPENAI_API_KEY}}

    response = requests.post(
        f"{DJANGO_URL}/environment/config/",
        json=environment_data,
        headers={"Host": rhost},
    )
    validate_response(response)


def get_tool(tool_alias: str) -> int:
    response_tools = requests.get(f"{DJANGO_URL}/tools/", headers={"Host": rhost})
    validate_response(response_tools)
    tool_list = response_tools.json()["results"]

    tool = list(filter(lambda tool: tool["name_alias"] == tool_alias, tool_list))

    return tool[0]["id"]


def create_graph(graph_name: str, entry_point: str | None = None) -> int:
    graph_data = {
        "name": graph_name,
        "entry_point": entry_point,
        "description": "Integration test graph",
        "metadata": {"key": "var"},
    }

    create_graph_response = requests.post(
        f"{DJANGO_URL}/graphs/", json=graph_data, headers={"Host": rhost}
    )
    validate_response(create_graph_response)
    return create_graph_response.json()["id"]


def create_python_code_tool(
    name: str,
    description: str,
    args_schema: dict,
    code: str,
    entrypoint: str = "main",
    libraries: list[str] | None = None,
    global_kwargs: dict[str, Any] | None = None,
) -> int:
    libraries = libraries or []
    global_kwargs = global_kwargs or {}
    tool_data = {
        "name": name,
        "description": description,
        "python_code": {
            "code": code,
            "entrypoint": entrypoint,
            "libraries": libraries,
            "global_kwargs": global_kwargs,
        },
        "args_schema": args_schema,
    }

    response = requests.post(
        f"{DJANGO_URL}/python-code-tool/", json=tool_data, headers={"Host": rhost}
    )
    validate_response(response)

    return response.json()["id"]


def get_python_code_tool_by_name(name: str) -> int | None:
    response = requests.get(
        f"{DJANGO_URL}/python-code-tool/?name={name}", headers={"Host": rhost}
    )
    validate_response(response)

    results = response.json()["results"]
    if len(results) == 0:
        return None
    return results[0]["id"]


def create_python_node(
    graph: int,
    node_name: str,
    code: str,
    input_map: dict,
    output_variable_path: str | None = None,
    entrypoint: str = "main",
    libraries: list[str] | None = None,
    global_kwargs: dict[str, Any] | None = None,
) -> int:
    libraries = libraries or []
    global_kwargs = global_kwargs or {}

    python_node_data = {
        "python_code": {
            "code": code,
            "entrypoint": entrypoint,
            "libraries": libraries,
            "global_kwargs": global_kwargs,
        },
        "node_name": node_name,
        "graph": graph,
        "input_map": input_map,
        "output_variable_path": output_variable_path,
    }

    response = requests.post(
        f"{DJANGO_URL}/pythonnodes/", json=python_node_data, headers={"Host": rhost}
    )
    validate_response(response)
    return response.json()["id"]


def create_crew_node(
    crew_id: int,
    node_name: str,
    graph_id: int,
    input_map: dict,
    output_variable_path: str | None = None,
) -> int:
    crew_node_data = {
        "crew_id": crew_id,
        "node_name": node_name,
        "graph": graph_id,
        "input_map": input_map,
        "output_variable_path": output_variable_path,
    }

    response = requests.post(
        f"{DJANGO_URL}/crewnodes/", json=crew_node_data, headers={"Host": rhost}
    )
    validate_response(response)
    return response.json()["id"]


def create_llm_node(
    llm_config_id: int,
    node_name: str,
    graph_id: int,
    input_map: dict,
    output_variable_path: str | None = None,
) -> int:
    llm_node_data = {
        "llm_config": llm_config_id,
        "node_name": node_name,
        "graph": graph_id,
        "input_map": input_map,
        "output_variable_path": output_variable_path,
    }

    response = requests.post(
        f"{DJANGO_URL}/llmnodes/", json=llm_node_data, headers={"Host": rhost}
    )
    validate_response(response)
    return response.json()["id"]


def create_edge(start_key: str, end_key: str, graph: int) -> int:

    edge_data = {"start_key": start_key, "end_key": end_key, "graph": graph}

    response = requests.post(
        f"{DJANGO_URL}/edges/", json=edge_data, headers={"Host": rhost}
    )
    validate_response(response)

    return response.json()["id"]


def create_conditional_edge(
    source: str,
    graph: int,
    code: str,
    then: str | None = None,
    entrypoint: str = "main",
    libraries: list[str] | None = None,
    global_kwargs: dict[str, Any] | None = None,
) -> int:
    libraries = libraries or []
    global_kwargs = global_kwargs or {}

    conditional_edge_data = {
        "source": source,
        "then": then,
        "graph": graph,
        "python_code": {
            "code": code,
            "entrypoint": entrypoint,
            "libraries": libraries,
            "global_kwargs": global_kwargs,
        },
    }

    response = requests.post(
        f"{DJANGO_URL}/conditionaledges/",
        json=conditional_edge_data,
        headers={"Host": rhost},
    )
    validate_response(response)

    return response.json()["id"]


def create_start_node(graph_id: int, variables: dict | None = None):
    if variables is None:
        variables = dict()
    create_start_node_data = {
        "graph": graph_id,
        "variables": variables,
    }

    response = requests.post(
        f"{DJANGO_URL}/startnodes/",
        json=create_start_node_data,
        headers={"Host": rhost},
    )
    validate_response(response)
    return response.json()["id"]


def create_wikipedia_crew(llm_config_id):
    # Create Wikipedia agent and crew
    wikipedia_tool_config_id = create_wikipedia_tool_config()
    wiki_agent_id = create_wiki_agent(
        tool_config_id_list=[wikipedia_tool_config_id], config_id=llm_config_id
    )
    wiki_crew_id = create_crew(name="WIKIPEDIA CREW", agents=[wiki_agent_id])
    wiki_task_id, wiki_task_name = create_wiki_task(
        crew_id=wiki_crew_id, agent_id=wiki_agent_id
    )
    return wiki_crew_id


def create_user_crew(llm_config_id):
    # Create Wikipedia agent and crew
    user_python_code_tool_id = create_user_python_code_tool()
    user_agent_id = create_user_agent(
        config_id=llm_config_id,
        python_code_tool_id_list=[user_python_code_tool_id],
    )
    user_crew_id = create_crew(name="USER CREW", agents=[user_agent_id])
    task_id, task_name = create_user_task(crew_id=user_crew_id, agent_id=user_agent_id)
    return user_crew_id


def create_author_crew(llm_config_id):
    author_agent_id = create_author_agent(config_id=llm_config_id)
    author_crew_id = create_crew(
        name="AUTHOR CREW",
        agents=[author_agent_id],
    )
    author_task_id, author_task_name = create_poem_task(
        crew_id=author_crew_id, agent_id=author_agent_id
    )
    return author_crew_id


def create_wikipedia_tool_config() -> int:
    wikipedia_tool_id = get_tool("wikipedia")

    tool_config_data = {
        "name": "integration test wiki tool config",
        "tool": wikipedia_tool_id,
        "configuration": {},
    }
    return create_tool_config(**tool_config_data)


def create_wiki_task(crew_id: int, agent_id: int) -> tuple:
    task_data = {
        "name": f"Test wiki task {random.randint(1,100000)}",
        "instructions": "Find inpormation about cars",
        "expected_output": "What is car",
        "order": 1,
        "crew": crew_id,
        "agent": agent_id,
    }

    return create_task(**task_data)


def create_poem_task(crew_id: int, agent_id: int) -> tuple:

    task_data = {
        "name": f"Test write poem task {random.randint(1,100000)}",
        "instructions": "Write short rhyming poem about nature",
        "expected_output": "Short rhyming poem",
        "order": 1,
        "crew": crew_id,
        "agent": agent_id,
    }
    return create_task(**task_data)


def create_user_task(crew_id: int, agent_id: int) -> tuple:

    task_data = {
        "name": f"user task",
        "instructions": "Get user name by user id {user_id}",
        "expected_output": "name",
        "order": 1,
        "crew": crew_id,
        "agent": agent_id,
        "output_model": {
            "type": "object",
            "title": "ArgumentsSchema",
            "properties": {
                "user_name": {
                    "type": "string",
                    "description": "Name of user",
                }
            },
        },
    }
    return create_task(**task_data)


def create_wiki_agent(
    tool_config_id_list: list,
    config_id: int,
) -> int:
    agent_data = {
        "configured_tools": tool_config_id_list,
        "role": "wikipedia_searcher",
        "goal": "search information in wikipedia",
        "backstory": "You are the agent who use tools to perform tasks",
        "allow_delegation": False,
        "memory": False,
        "max_iter": 15,
        "llm_config": config_id,
        "fcm_llm_config": config_id,
    }
    return create_agent(**agent_data)


def create_author_agent(
    config_id: int,
) -> int:
    agent_data = {
        "role": "poem writer",
        "goal": "write short poem",
        "backstory": "You are the agent who writes rhyming poems",
        "allow_delegation": False,
        "memory": False,
        "max_iter": 15,
        "llm_config": config_id,
        "fcm_llm_config": config_id,
    }
    return create_agent(**agent_data)


def create_user_agent(config_id: int, python_code_tool_id_list: list[int]) -> int:
    agent_data = {
        "role": "User Agent",
        "goal": "Persorm user related actions",
        "backstory": "Use tools to perform tasks",
        "allow_delegation": False,
        "memory": False,
        "python_code_tools": python_code_tool_id_list,
        "max_iter": 15,
        "llm_config": config_id,
        "fcm_llm_config": config_id,
    }
    return create_agent(**agent_data)


def create_user_python_code_tool() -> int:

    code = """
def main(user_id: int):
    ids = {
        14: "Artur",
        2: "Max",
        36: "Igor",
    }
    print(state["variables"])
    return ids.get(user_id, "Not found")
"""

    test_state = {"input": {"user_surname": "Zelensky"}}
    args_schema = {
        "type": "object",
        "title": "ArgumentsSchema",
        "properties": {
            "user_id": {"type": "integer", "description": "id of user"},
        },
    }

    tool_data = {
        "name": "python tool1",
        "description": "Get user name from id",
        "code": code,
        "entrypoint": "main",
        "libraries": ["requests"],
        "global_kwargs": {"state": test_state},
        "args_schema": args_schema,
    }
    tool = get_python_code_tool_by_name(tool_data["name"])
    if tool is not None:
        tool_data["name"] = f"{tool_data['name']}_{str(uuid.uuid4())}"
    tool = create_python_code_tool(**tool_data)
    return tool


def create_hash_message_python_node(graph_id: int) -> int:
    code = """
import hashlib
def main(user_id: int, secret_message: str):
    m = hashlib.sha256(secret_message.encode()).hexdigest()
    return {'hash': m, 'user_id': user_id}
"""

    python_node_data = {
        "libraries": [],
        "code": code,
        "entrypoint": "main",
        "global_kwargs": {},
        "node_name": "hash_message",
        "graph": graph_id,
        "input_map": {
            "user_id": "variables.user_id",
            "secret_message": "variables.secret_message",
        },
        "output_variable_path": "variables",
    }

    return create_python_node(**python_node_data)


def create_option_1_python_node(graph_id: int) -> int:
    code = """
def main(*args, **kwargs):
    return {'query': f"Famous {kwargs.get('user_name')}s in the world"}
"""

    python_node_data = {
        "libraries": [],
        "code": code,
        "entrypoint": "main",
        "global_kwargs": {},
        "node_name": "option_1",
        "graph": graph_id,
        "input_map": {
            "user_name": "variables.user_name",
        },
        "output_variable_path": "variables",
    }
    return create_python_node(**python_node_data)


def create_option_2_python_node(graph_id: int) -> int:
    code = """
def main(*args, **kwargs):
    return {'result': "option_2"}
"""

    python_node_data = {
        "libraries": [],
        "code": code,
        "entrypoint": "main",
        "global_kwargs": {},
        "node_name": "option_2",
        "graph": graph_id,
        "input_map": {
            "user_name": "variables.user_name",
        },
        "output_variable_path": "variables",
    }

    return create_python_node(**python_node_data)


def create_user_name_conditional_edge(source: str, graph: int):
    code = """
def main():
    user_name = state["variables"]["user_name"]

    if user_name == "Artur":
        return "option_1"
    else:
        return "option_2"
"""

    conditional_edge_data = {
        "source": source,
        "graph": graph,
        "code": code,
    }
    return create_conditional_edge(**conditional_edge_data)


def get_llm_model(name: str = "gpt-4o-mini"):
    llm_model_response = requests.get(
        f"{DJANGO_URL}/llm-models?name={name}", headers={"Host": rhost}
    )
    llm_model = None
    if llm_model_response.ok:
        results = llm_model_response.json()["results"]
        if len(results) > 0:
            llm_model = results[0]
    return llm_model["id"]


def delete_graph(graph_id: int):
    url = f"{DJANGO_URL}/graphs/{graph_id}/"
    response = requests.delete(url, headers={"Host": rhost})

    if response.ok:
        logger.info(f"Graph {graph_id} successfully deleted")
    else:
        logger.warning(
            f"Failed to delete graph {graph_id}: {response.status_code}, {response.text}"
        )


def delete_crew(crew_id: int):
    url = f"{DJANGO_URL}/crews/{crew_id}/"
    response = requests.delete(url, headers={"Host": rhost})

    if response.ok:
        logger.info(f"Crew {crew_id} successfully deleted")
    else:
        logger.warning(
            f"Failed to delete crew {crew_id}: {response.status_code}, {response.text}"
        )


def delete_config(config_id: int):
    url = f"{DJANGO_URL}/llm-configs/{config_id}/"
    response = requests.delete(url, headers={"Host": rhost})

    if response.ok:
        logger.info(f"LLM Config {config_id} successfully deleted")
    else:
        logger.warning(
            f"Failed to delete LLM Config {config_id}: {response.status_code}, {response.text}"
        )
