from .base_handler import AbstractHandler


from loguru import logger


import asyncio
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List
from services.venv_manager_service import VenvManagerService

class InstallLibrariesHandler(AbstractHandler):
    def __init__(self, venv_manager_service: VenvManagerService):

        self.venv_manager_service = venv_manager_service

    async def handle(self, context: Dict[str, Any]) -> Any:
        """Install libraries asynchronously."""
        self.venv_manager_service.install_libraries(venv_name=context["venv_name"])
        