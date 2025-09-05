import json
import uuid
import asyncio
from typing import Any

from loguru import logger
from utils.singleton_meta import SingletonMeta
from services.redis_service import RedisService
from models.request_models import CodeResultData, CodeTaskData, PythonCodeData


class PythonCodeExecutorService(metaclass=SingletonMeta):
    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service

    async def run_code(
        self,
        python_code_data: PythonCodeData,
        inputs: dict[str, Any],
        additional_global_kwargs: dict[str, Any] | None = None,
    ) -> dict:
        additional_global_kwargs = additional_global_kwargs or {}
        venv_name = python_code_data.venv_name
        code = python_code_data.code
        entrypoint = python_code_data.entrypoint

        global_kwargs = python_code_data.global_kwargs or {}

        unique_task_id = str(uuid.uuid4())
        request_data = {
            "id": unique_task_id,
            "type": "execute_code",
            "data": {
                "venv_name": venv_name,
                "code": code,
                "entrypoint": entrypoint,
                "func_kwargs": inputs,
                "global_kwargs": {**global_kwargs, **additional_global_kwargs},
            },
        }

        pubsub = await self.redis_service.async_subscribe("code_results")
        await self.redis_service.async_publish(
            "code_exec_tasks", request_data
        )
        logger.info("Waiting for code_results")

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message and message["type"] == "message":
                code_result_data: dict = json.loads(message["data"])
                execution_id = code_result_data.get("id")

                if execution_id != unique_task_id:
                    continue

                data = code_result_data.get("data")
                status = code_result_data.get("status")
                execution_message = code_result_data.get("message", "Fatal error during code execution")

                pubsub.unsubscribe("code_results")
                return data if status == "success" else execution_message
            
            await asyncio.sleep(0.1)
            