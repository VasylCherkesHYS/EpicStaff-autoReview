from __future__ import annotations

import uuid

from app.models import ToolResult
from app.sandbox.client import SandboxClient
from app.tools.descriptors import PythonCodeToolDescriptor
from shared.models.tools import CodeTaskData


class PythonCodeToolExecutor:
    def __init__(
        self, sandbox: SandboxClient, descriptor: PythonCodeToolDescriptor
    ) -> None:
        self._sandbox = sandbox
        self._descriptor = descriptor

    async def __call__(self, args: dict) -> ToolResult:
        task = CodeTaskData(
            venv_name=self._descriptor.venv_name,
            libraries=self._descriptor.libraries,
            code=self._descriptor.code,
            execution_id=str(uuid.uuid4()),
            entrypoint=self._descriptor.entrypoint,
            func_kwargs={**self._descriptor.configuration, **args},
            global_kwargs=self._descriptor.global_kwargs,
            use_storage=False,
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
