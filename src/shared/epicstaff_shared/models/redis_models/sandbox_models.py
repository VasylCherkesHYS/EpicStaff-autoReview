from .base import *


class VenvRequestType(Enum):
    CREATE_VENV = "create_venv"
    INSTALL_LIBRARIES = "install_libraries"
    GET_LIBRARIES = "get_libraries"
    GET_VENV_EXISTS = "get_venv_exists"
    REMOVE_VENV = "remove_venv"
    EXECUTE_CODE = "execute_code"


VenvRequestTypeLiteral = Literal[
    "create_venv",
    "install_libraries",
    "get_libraries",
    "get_venv_exists",
    "remove_venv",
    "execute_code",
]


class VenvRequest(RedisRequest[D], Generic[D]):
    type: VenvRequestTypeLiteral


# Request
class CreateVenvRequestData(BaseModel):

    venv_name: str
    libraries: list[str] | None = None


class InstallLibrariesRequestData(BaseModel):
    venv_name: str
    libraries: list[str] | None


class GetLibrariesRequestData(BaseModel):
    venv_name: str


class GetVenvExistsRequestData(BaseModel):
    venv_name: str


class RemoveVenvRequestData(BaseModel):
    venv_name: str


class ExecuteCodeRequestData(BaseModel):
    venv_name: str
    code: str
    entrypoint: str = "main"
    func_kwargs: dict[str, Any] | None = None
    global_kwargs: dict[str, Any] | None = None


class RemoveVenvRequest(VenvRequest[RemoveVenvRequestData]):
    type: Literal["remove_venv"] = Field(default="remove_venv", frozen=True)


class GetVenvExistsRequest(VenvRequest[GetVenvExistsRequestData]):
    type: Literal["get_venv_exists"] = Field(default="get_venv_exists", frozen=True)


class GetLibrariesRequest(VenvRequest[GetLibrariesRequestData]):
    type: Literal["get_libraries"] = Field(default="get_libraries", frozen=True)


class InstallLibrariesRequest(VenvRequest[InstallLibrariesRequestData]):
    type: Literal["install_libraries"] = Field(default="install_libraries", frozen=True)


class CreateVenvRequest(VenvRequest[CreateVenvRequestData]):
    type: Literal["create_venv"] = Field(default="create_venv", frozen=True)


class ExecuteCodeRequest(VenvRequest[ExecuteCodeRequestData]):
    type: Literal["execute_code"] = Field(default="execute_code", frozen=True)


# Response


class CreateVenvResponseData(BaseModel): ...


class InstallLibrariesResponseData(BaseModel): ...


class RemoveVenvResponseData(BaseModel): ...


class GetLibrariesResponseData(BaseModel):
    venv_name: str
    libraries: list[str]


class GetVenvExistsResponseData(BaseModel):
    exists: bool


class ExecuteCodeResponseData(BaseModel):
    result_data: str
    stderr: str
    stdout: str
    returncode: int


class CreateVenvResponse(RedisResponse[CreateVenvResponseData]): ...


class InstallLibrariesResponse(RedisResponse[InstallLibrariesResponseData]): ...


class RemoveVenvResponse(RedisResponse[RemoveVenvResponseData]): ...


class GetLibrariesResponse(RedisResponse[GetLibrariesResponseData]): ...


class GetVenvExistsResponse(RedisResponse[GetVenvExistsResponseData]): ...


class ExecuteCodeResponse(RedisResponse[ExecuteCodeResponseData]): ...
