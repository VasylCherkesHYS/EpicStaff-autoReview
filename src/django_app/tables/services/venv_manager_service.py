from asyncio import Queue
from datetime import datetime
from queue import Empty
import threading
import time
import json
import os
from typing import Any, Iterable
import uuid

from loguru import logger
from tables.models.python_models import Venv
from tables.models.domain_task_models import (
    DomainTask,
    DomainTaskStatusChoices,
    TypeChoices,
)
from tables.exceptions import CustomAPIExeption
from tables.models import PythonCodeResult
from tables.request_models import CodeTaskData
from tables.models import PythonCode
from tables.services.redis_service import RedisService
from utils.singleton_meta import SingletonMeta
from django.db import transaction
from tables.utils.gen_time_now import gen_time_now

class VenvManagerService(metaclass=SingletonMeta):

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
        self.sandbox_request_channel: str = os.environ.get(
            "SANDBOX_REQUEST_CHANNEL", "sandbox"
        )
        self.sandbox_response_channel: str = os.environ.get(
            "SANDBOX_RESPONSE_CHANNEL", "sandbox-response"
        )

    def __wait_for_response(self, id_: str, queue: Queue, timeout: float = 5.0):
        client = self.redis_service.redis_client
        pubsub = client.pubsub()
        try:
            pubsub.subscribe(self.sandbox_response_channel)
            start = time.time()
            while time.time() - start < timeout:
                message = self.pubsub.get_message(timeout=1)
                if message and message["type"] == "message":
                    data = json.loads(message["data"])
                    if data["id_"] == id_:
                        queue.put(message["data"])
                        return
                time.sleep(0.01)  # не грузим CPU
            queue.put(None)  # по таймауту
        except Exception as e:
            pass
        finally:
            pubsub.unsubscribe()
            del pubsub

    # def __send_and_wait(self, type: str, data: dict, timeout: float = 5.0) -> dict | None:
    #     id_ = self.gen_execution_id()
    #     message = json.dumps({"id_": id_, "type": type, "data": data})

    #     client = self.redis_service.redis_client
    #     client.publish(channel=self.sandbox_request_channel, message=message)

    #     response_queue = Queue()
    #     wait_thread = threading.Thread(
    #         target=self.__wait_for_response,
    #         args=(id_, response_queue, timeout),
    #         daemon=True
    #     )
    #     wait_thread.start()

    #     try:
    #         response_raw = response_queue.get(timeout=timeout + 1)
    #         if response_raw is None:
    #             return None
    #         response = json.loads(response_raw)
    #     except Empty:
    #         return None

    #     if response["status"] != "success":
    #         raise CustomAPIExeption(detail=response["message"], status_code=400)

    #     return response

    def __send_venv_request(self, id_: str, type: str, data: dict) -> None:

        message = json.dumps({"id": id_, "type": type, "data": data})
        client = self.redis_service.redis_client
        client.publish(channel=self.sandbox_request_channel, message=message)

    def venv_exists(self, id_: str, venv_name: str) -> None:
        """Check if a virtual environment already exists."""
        return self.__send_venv_request(
            id_=id_, type="get_venv_exists", data={"venv_name": venv_name}
        )

    def create_venv(self, id_: str, venv_name) -> None:
        """Create virtual environment task."""
        return self.__send_venv_request(
            id_=id_, type="create_venv", data={"venv_name": venv_name}
        )

    def remove_venv(self, id_: str, venv_name: str) -> None:
        return self.__send_venv_request(
            id_=id_, type="remove_venv", data={"venv_name": venv_name}
        )

    def install_libraries(
        self,
        id_: str,
        venv_name: str,
        libraries: Iterable[str] | None,
    ) -> None:
        return self.__send_venv_request(
            id_=id_,
            type="remove_venv",
            data={"venv_name": venv_name, "libraries": libraries},
        )

    def library_list(self, id_: str, venv_name) -> None:
        return self.__send_venv_request(
            id_=id_, type="remove_venv", data={"venv_name": venv_name}
        )

    def handle_sandbox_response(self, id_: str, status: str, data: dict, message: str):
        """Handle the response from the sandbox."""

        domain_task = DomainTask.objects.filter(id=id_).first()

        assert domain_task, f"DomainTask with id {id_} not found"

        domain_task.status = status
        domain_task.message = message
        domain_task.data = data
        domain_task.updated_at = datetime.now()
        domain_task.save()
        if domain_task.status == DomainTaskStatusChoices.SUCCESS:
            match domain_task.type:
                case "get_libraries":
                    self.handle_get_libraries_response(domain_task)
                case "get_venv_exists":
                    self.handle_get_venv_exists_response(domain_task)
                # case "create_venv":
                #     self.handle_create_venv_response(domain_task)
                # case "install_libraries":
                #     self.handle_install_libraries_response(domain_task)
                # case "remove_venv":
                #     self.handle_remove_venv_response(domain_task)

    def handle_get_libraries_response(self, domain_task: DomainTask):
        """Handle the response for getting libraries from a virtual environment."""
        data = domain_task.data
        venv_name = domain_task.payload.get("venv_name")
        if not data or "libraries" not in data:
            raise ValueError("Task data is missing required key 'libraries'")

        libraries = data["libraries"]

        try:
            # Use a database transaction to prevent race conditions
            with transaction.atomic():

                venv = Venv.objects.select_for_update().get(venv_name=venv_name)

                updated_data = venv.actual_data or {}
                updated_data.update(
                    {
                        "libraries": libraries,
                        "libraries_last_update": gen_time_now(),
                    }
                )

                venv.actual_data = updated_data
                venv.save()

        except Venv.DoesNotExist:
            logger.error(f"Venv with name '{venv_name}' not found.")

    def handle_get_venv_exists_response(self, domain_task: DomainTask):
        """Handle the response for checking if a virtual environment exists."""

        data = domain_task.data
        venv_name = domain_task.payload.get("venv_name")

        if not data or "exists" not in data:
            raise ValueError("Task data is missing required key 'exists'")

        venv_exists = data["exists"]

        try:
            # Use a database transaction to prevent race conditions
            with transaction.atomic():

                venv = Venv.objects.select_for_update().get(venv_name=venv_name)

                updated_data = venv.actual_data or {}
                updated_data.update(
                    {
                        "venv_exists": venv_exists,
                        "venv_exists_last_update": gen_time_now(),
                    }
                )

                venv.actual_data = updated_data
                venv.save()

        except Venv.DoesNotExist:
            logger.error(f"Venv with name '{venv_name}' not found.")

    # def handle_remove_venv_response(self, domain_task: DomainTask):
    #     """Handle the response for removing a virtual environment."""

    # def handle_create_venv_response(self, domain_task: DomainTask):
    #     """
    #     Handle the response for creating a virtual environment, updating the
    #     corresponding Venv object in the database.
    #     """

    # def handle_install_libraries_response(self, domain_task: DomainTask):
    #     """Handle the response for installing libraries in a virtual environment."""

    #     """Nothing to handle"""
