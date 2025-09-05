import json
import os
from typing import Any
from tables.request_models import CodeTaskData
from tables.services.redis_service import RedisService
from utils.singleton_meta import SingletonMeta


class RunPythonCodeService(metaclass=SingletonMeta):

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.code_exec_task_channel: str = os.environ.get(
            "CODE_EXEC_TASK_CHANNEL", "code_exec_tasks"
        )

    def run_code(
        self,
        execution_id: str,
        venv_name: str,
        python_code: str,
        entrypoint: str,
        varaibles: dict,
        global_kwargs: dict[str, Any] = {},
    ) -> None:
        """
        Sends a Redis request to execute Python code.

        Args:
            execution_id (str): Unique identifier for the execution.
            venv_name (str): The name of the virtual environment to use.
            python_code (str): Python code in the database.
            entrypoint (str): The entry point function to execute in the Python code.
            variables (dict): A dictionary containing key-value pairs to be used as input for the Python code.
            global_kwargs (dict[str, Any], optional): Additional global keyword arguments to pass to the Python code. Defaults to an empty dictionary.
        """
        additional_global_kwargs = additional_global_kwargs or {}

        request_data = {
            "id": execution_id,
            "type": "execute_code",
            "data": {
                "venv_name": venv_name,
                "code": python_code,
                "entrypoint": entrypoint,
                "func_kwargs": varaibles,
                "global_kwargs": {**global_kwargs, **additional_global_kwargs},
            },
        }

        channel = self.code_exec_task_channel
        self.redis_service.redis_client.publish(
            channel, json.dumps(request_data)
        )
