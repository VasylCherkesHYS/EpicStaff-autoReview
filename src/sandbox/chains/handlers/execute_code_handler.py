from .base_handler import AbstractHandler


from loguru import logger


import asyncio
from pathlib import Path
from typing import Any, Dict


class ExecuteCodeHandler(AbstractHandler):

    def wrap_code(
        self,
        code: str,
        result_file_path: Path,
        entrypoint: str,
        func_kwargs: dict[str, Any],
        global_kwargs: dict[str, Any] | None = None,
    ):
        global_kwargs = global_kwargs or dict()
        code_lines = code.split("\n")
        code_lines = ["    " + line for line in code_lines]
        code = "\n".join(code_lines)
        wrapped_code = f"""
import sys
import json
from dotdict import DotDict
try:
    for k, v in {global_kwargs}.items():
        globals()[k] = v
    
{code}
    
    __sys_dot_kwargs = DotDict({func_kwargs})
    
    sys_result_variable = {entrypoint}(**__sys_dot_kwargs)
    with open(r'{result_file_path.as_posix()}', 'w', encoding='utf-8') as file:
        if isinstance(sys_result_variable, DotDict):
            sys_result_variable = sys_result_variable.model_dump()
        file.write(json.dumps(sys_result_variable))
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
sys.exit(0)
"""

        return wrapped_code

    async def handle(self, context: Dict[str, Any]) -> dict:
        """Execute the provided code asynchronously."""
        python_executable = context["python_executable"]

        temp_code_path = context["temp_code_path"]

        wrapped_code = self.wrap_code(
            code=context["code"],
            result_file_path=context["result_file_path"],
            entrypoint=context["entrypoint"],
            func_kwargs=context["func_kwargs"],
            global_kwargs=context["global_kwargs"],
        )

        # Write the code to a temporary file
        with open(temp_code_path, "w") as f:
            f.write(wrapped_code)

        # Execute the code asynchronously
        logger.info(f"Executing code using {python_executable}...")
        process = await asyncio.create_subprocess_shell(
            f"{python_executable} {temp_code_path}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        stderr = stderr.decode("utf-8", errors="replace")
        stdout = stdout.decode("utf-8", errors="replace")
        returncode = process.returncode
        if stderr:
            logger.info(f"Error: {stderr}")

        result_file_path: Path | str = context["result_file_path"]
        if isinstance(result_file_path, Path):
            result_file_path = result_file_path.as_posix()

        result_data = None

        if returncode == 0:
            try:
                with open(result_file_path, "r", encoding="utf-8") as file:
                    result_data = file.read()
            except Exception:
                logger.exception("Exception reading result file")

        if self._next_handler:
            return super().handle(context)

        return {
            "execution_id": context["execution_id"],
            "result_data": result_data,
            "stderr": stderr,
            "stdout": stdout,
            "returncode": returncode,
        }
        # return CodeResultData(
        #     execution_id=context["execution_id"],
        #     result_data=result_data,
        #     stderr=stderr,
        #     stdout=stdout,
        #     returncode=returncode,
        # )
