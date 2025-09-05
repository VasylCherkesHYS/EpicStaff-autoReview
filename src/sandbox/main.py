import asyncio
import json
import os
from pathlib import Path
from epicstaff_shared.services.redis_service.redis_router import Context, ResponseDTO
from loguru import logger
from epicstaff_shared import *

from services.execute_code_service import ExecuteCodeService
from services.exceptions import CreateVenvException, VenvException
from services.venv_manager_service import VenvManagerService
from epicstaff_shared.services.redis_service import AsyncFilter, SyncFilter
from epicstaff_shared.services import RedisService, RedisRouter
from epicstaff_shared.models import *
from epicstaff_shared.models.redis_models import (
    VenvRequestType,
)
from utils.execute_command import ExecuteCommandException

redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
redis_port = int(os.environ.get("REDIS_PORT", "6379"))
code_result_channel = os.environ.get("CODE_RESULT_CHANNEL", "code_results")
task_channel = os.environ.get("CODE_EXEC_TASK_CHANNEL", "code_exec_tasks")
output_path = Path(os.environ.get("OUTPUT_PATH", "../test_dir/executions"))
base_venv_path = Path(os.environ.get("BASE_VENV_PATH", "../test_dir"))

venv_channel = os.environ.get("VENV_CHANNEL", "venv_manager")

os.chdir("savefiles")

rs = RedisService(host=redis_host, port=redis_port)
router = RedisRouter(redis_service=rs)
venv_manager_service = VenvManagerService(
    output_path=output_path,
    base_venv_path=base_venv_path,
)
execute_code_service = ExecuteCodeService(
    venv_manager_service=venv_manager_service,
    output_path=output_path,
    base_venv_path=base_venv_path,
)

class RequestTypeFilter(SyncFilter):

    def __init__(self, request_type: VenvRequestType):
        self.request_type = request_type

    def __call__(self, context: Context):
        try:
            request = VenvRequest[dict].model_validate_json(context.message.data)
        except Exception as e:
            logger.error(f"Failed to parse message: {context.message}. Error: {e}")
            return False
        return request.type == self.request_type.value


@router.redis_handler(
    subscribe_channel="sandbox",
    publish_channel="sandbox-response",
    filters=[RequestTypeFilter(request_type=VenvRequestType.CREATE_VENV)],
    response_model=CreateVenvResponse,
    request_model=CreateVenvRequest,
)
async def create_venv(context: Context):
    data: CreateVenvRequestData = context.validated_request.data
    result = await venv_manager_service.create_venv(data.venv_name)

    return ResponseDTO(
        status=StatusCode.SUCCESS,
        message="Virtual environment created successfully.",
    )


@router.redis_handler(
    subscribe_channel="sandbox",
    publish_channel="sandbox-response",
    filters=[RequestTypeFilter(request_type=VenvRequestType.GET_LIBRARIES)],
    response_model=GetLibrariesResponse,
    request_model=GetLibrariesRequest,
)
async def get_libraries(context: Context):
    data: GetLibrariesRequestData = context.validated_request.data
    libraries = await venv_manager_service.library_list(data.venv_name)

    response_data = GetLibrariesResponseData(
        venv_name=data.venv_name, libraries=libraries
    )

    return ResponseDTO(
        status=StatusCode.SUCCESS,
        data=response_data.model_dump(),
        message="Libraries retrieved successfully.",
    )


@router.redis_handler(
    subscribe_channel="sandbox",
    publish_channel="sandbox-response",
    filters=[RequestTypeFilter(request_type=VenvRequestType.GET_VENV_EXISTS)],
    response_model=GetVenvExistsResponse,
    request_model=GetVenvExistsRequest,
)
async def get_venv_exists(context: Context):
    data: GetVenvExistsRequestData = context.validated_request.data
    venv_exists = venv_manager_service.venv_exists(data.venv_name)
    response_data = GetVenvExistsResponseData(exists=venv_exists)

    return ResponseDTO(
        status=StatusCode.SUCCESS,
        data=response_data.model_dump(),
        message="Libraries retrieved successfully.",
    )


@router.redis_handler(
    subscribe_channel="sandbox",
    publish_channel="sandbox-response",
    filters=[RequestTypeFilter(request_type=VenvRequestType.INSTALL_LIBRARIES)],
    response_model=InstallLibrariesResponse,
    request_model=InstallLibrariesRequest,
)
async def install_libraries(context: Context):
    data: InstallLibrariesRequestData = context.validated_request.data
    await venv_manager_service.install_libraries(
        venv_name=data.venv_name, libraries=data.libraries
    )

    return ResponseDTO(
        status=StatusCode.SUCCESS,
        data={},
        message="Libraries installed successfully.",
    )


@router.redis_handler(
    subscribe_channel="sandbox",
    publish_channel="sandbox-response",
    filters=[RequestTypeFilter(request_type=VenvRequestType.REMOVE_VENV)],
    response_model=RemoveVenvResponse,
    request_model=RemoveVenvRequest,
)
async def remove_venv(context: Context):
    data: RemoveVenvRequestData = context.validated_request.data
    await venv_manager_service.remove_venv(venv_name=data.venv_name)

    return ResponseDTO(
        status=StatusCode.SUCCESS,
        data={},
        message="Virtual environment removed successfully.",
    )


@router.redis_handler(
    subscribe_channel="code_exec_tasks",
    publish_channel="code_results",
    filters=[RequestTypeFilter(request_type=VenvRequestType.EXECUTE_CODE)],
    response_model=ExecuteCodeResponse,
    request_model=ExecuteCodeRequest,
)
async def execute_code(context: Context):
    request_id = context.validated_request.id
    data: ExecuteCodeRequestData = context.validated_request.data
    result = await execute_code_service.execute_code(
        code=data.code,
        entrypoint=data.entrypoint,
        func_kwargs=data.func_kwargs or {},
        global_kwargs=data.global_kwargs or {},
        venv_name=data.venv_name,
        execution_id=request_id,
    )
    response_data = ExecuteCodeResponseData(
        result_data=result.result_data,
        stderr=result.stderr,
        stdout=result.stdout,
        returncode=result.returncode,
    )
    if result.returncode != 0:
        return ResponseDTO(
            status=StatusCode.ERROR,
            data=response_data.model_dump(),
            message="Code execution failed.",
        )
    return ResponseDTO(
        status=StatusCode.SUCCESS,
        data=response_data.model_dump(),
        message="Code executed successfully.",
    )


async def main():

    await router.register_all()

    while True:
        await asyncio.sleep(1)  # Keep the event loop running


if __name__ == "__main__":
    asyncio.run(main())
