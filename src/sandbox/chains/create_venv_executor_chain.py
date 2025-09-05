from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Optional
from loguru import logger
import epicstaff_shared
from .handlers.execute_code_handler import ExecuteCodeHandler
from .handlers.create_venv_handler import CreateVenvHandler
from .handlers.dummy_handler import DummyHandler
from .handlers.base_handler import Handler


class CreateVenvExecutorChain:

    def __init__(
        self,
        output_path: str | Path,
        base_venv_path: str | Path,
    ):
        self.output_path = output_path
        self.base_venv_path = base_venv_path

        # Build the chain of responsibility
        execute_code_handler = ExecuteCodeHandler()

        self.chain: Handler = DummyHandler()

        self.chain.set_next(execute_code_handler)

    async def run(
        self,
        venv_name: str,
        execution_id: str,
        code: str,
        entrypoint: str = "main",
        func_kwargs: dict[str, Any] | None = None,
        global_kwargs: dict[str, Any] | None = None,
    ):
        """Run the complete workflow asynchronously."""
        if func_kwargs is None:
            func_kwargs = dict()

        output_path = Path(self.output_path) / execution_id
        venv_path = Path(self.base_venv_path) / venv_name
        os.makedirs(output_path, exist_ok=True)
        os.makedirs(self.base_venv_path, exist_ok=True)

        context = {
            "venv_path": venv_path,
            "python_executable": (
                venv_path / Path(f"bin/python")
                if os.name != "nt"
                else venv_path / Path("Scripts/python")
            ),
            "temp_code_path": output_path / "code.py",
            "hash_file": venv_path / "libhash",
            "code": code,
            "result_file_path": output_path / "output.txt",
            "entrypoint": entrypoint,
            "func_kwargs": func_kwargs,
            "execution_id": execution_id,
            "global_kwargs": global_kwargs,
        }

        result = await self.chain.handle(context)
        logger.info(result)
        return result
