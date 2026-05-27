from pydantic import BaseModel, ConfigDict


class PythonCodeToolDescriptor(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    description: str
    args_schema: dict
    code: str
    entrypoint: str
    libraries: list[str]
    configuration: dict
    global_kwargs: dict
    venv_name: str


class McpToolDescriptor(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    description: str
    args_schema: dict
    transport: str
    tool_name: str
    timeout: float | None = 30
    auth: str | None = None
    init_timeout: float | None = 10
