from __future__ import annotations

import uuid

from shared.models.agent_service import ToolResult
from shared.models.tools import CodeTaskData, PythonCodeToolData

from app.sandbox.client import SandboxClient


class PythonCodeToolExecutor:
    """Executes a Python-code tool via the sandbox service.

    Storage wiring (use_storage, storage_allowed_paths, storage_org_prefix,
    session_id) is injected by the caller at construction time once S3 refs
    are resolved — for now they default to disabled/None.
    """

    def __init__(
        self,
        sandbox: SandboxClient,
        data: PythonCodeToolData,
        *,
        use_storage: bool = False,
        storage_allowed_paths: list[str] | None = None,
        storage_org_prefix: str | None = None,
        session_id: int | None = None,
    ) -> None:
        self._sandbox = sandbox
        self._data = data
        self._use_storage = use_storage
        self._storage_allowed_paths = storage_allowed_paths
        self._storage_org_prefix = storage_org_prefix
        self._session_id = session_id

    async def __call__(self, args: dict) -> ToolResult:
        python_code = self._data.python_code

        task = CodeTaskData(
            venv_name=python_code.venv_name,
            libraries=python_code.libraries,
            code=python_code.code,
            execution_id=str(uuid.uuid4()),
            entrypoint=python_code.entrypoint,
            func_kwargs=args,
            use_storage=self._use_storage,
            storage_allowed_paths=self._storage_allowed_paths,
            storage_org_prefix=self._storage_org_prefix,
            session_id=self._session_id,
        )

        try:
            result = await self._sandbox.submit(task)
        except Exception as error:
            return ToolResult(
                tool_call_id="",
                content=f"Sandbox transport error: {error}",
                is_error=True,
            )

        if result.returncode != 0 or result.stderr:
            return ToolResult(
                tool_call_id="",
                content=result.stderr or result.stdout or "Sandbox returned non-zero",
                is_error=True,
            )

        return ToolResult(
            tool_call_id="",
            content=result.result_data or "",
            is_error=False,
        )
