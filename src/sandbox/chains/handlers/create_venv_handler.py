from .base_handler import AbstractHandler


from loguru import logger


import asyncio
import sys
from typing import Any, Dict


class CreateVenvHandler(AbstractHandler):
    async def handle(self, context: Dict[str, Any]) -> Any:
        """Create virtual environment task."""
        venv_path = context.get("venv_path")

        if not venv_path.exists():
            logger.info(f"Creating virtual environment at {venv_path}...")
            process = await asyncio.create_subprocess_shell(
                f"{sys.executable} -m venv {venv_path}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.communicate()
        else:
            logger.info(f"Virtual environment already exists at {venv_path}.")

        if self._next_handler:
            return await super().handle(context)
        return "Virtual environment created."
