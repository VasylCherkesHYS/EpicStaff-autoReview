import asyncio
import os
from pathlib import Path
import shutil
import sys
from loguru import logger
import hashlib
import json

from typing import Any, Iterable, List
from utils.singleton_meta import SingletonMeta
from epicstaff_shared.models.redis_models import *
from .exceptions import CreateVenvException, RemoveVenvException, VenvException
from utils.execute_command import execute_command, ExecuteCommandException

class VenvManagerService(metaclass=SingletonMeta):

    # request_type = RedisRequest[VenvRequestType]

    def __init__(
        self,
        output_path: str | Path,
        base_venv_path: str | Path,
    ):
        self.output_path = output_path
        self.base_venv_path = base_venv_path

    def get_venv_path(self, venv_name) -> Path:
        return Path(self.base_venv_path) / venv_name

    def get_python_executable(self, venv_path: Path) -> Path:
        if os.name == "nt":
            return venv_path / "Scripts" / "python.exe"
        else:
            return venv_path / "bin" / "python"

    def get_hash_file(self, venv_path: Path) -> Path:
        return venv_path / "libhash"
        

    def venv_exists(self, venv_name: str) -> bool:
        """Check if a virtual environment already exists."""
        venv_path = self.get_venv_path(venv_name)
        python_executable = self.get_python_executable(venv_path)

        # Check if both the venv directory and python executable exist
        return venv_path.exists() and python_executable.exists()

    async def create_venv(self, venv_name) -> None:
        """Create virtual environment task."""
        venv_path = self.get_venv_path(venv_name=venv_name)
        python_executable = self.get_python_executable(venv_path=venv_path)

        if self.venv_exists(venv_name=venv_name):
            error = f"Virtual environment already exists at {venv_path}."
            logger.error(error)
            raise CreateVenvException(error)

        logger.info(f"Creating virtual environment at {venv_path}...")
        await execute_command(command=f"{sys.executable} -m venv {venv_path}")
        await execute_command(
            command=f"{python_executable} -m pip install --upgrade pip"
        )

    async def remove_venv(self, venv_name) -> None:
        venv_path = self.get_venv_path(venv_name=venv_name)
        if not self.venv_exists(venv_name=venv_name):
            error = f"Virtual environment doesn't exist at {venv_path}."
            logger.error(error)
            raise RemoveVenvException(error)

        logger.info(f"Removing virtual environment at {venv_path}...")
        await execute_command(f"rm -rf {venv_path}")

    def _calculate_hash(self, libraries: List[str]) -> str:
        """Calculate a hash of the libraries list."""
        libraries_str = json.dumps(libraries, sort_keys=True)
        return hashlib.sha256(libraries_str.encode("utf-8")).hexdigest()

    def _hash_changed(self, lib_hash: str, hash_file: Path) -> bool:
        """Check if the hash of the libraries has changed."""
        if hash_file.exists():
            with open(hash_file, "r") as f:
                saved_hash = f.read().strip()
            return lib_hash != saved_hash
        return True

    def _update_hash(self, lib_hash: str, hash_file: Path):
        """Update the hash file with the current hash."""
        with open(hash_file, "w") as f:
            f.write(lib_hash)

    async def install_libraries(
        self, venv_name: str, libraries: Iterable[str] | None,
    ) -> list[str]:
        """Install libraries."""

        if not libraries:
            libraries = set()

        venv_path = self.get_venv_path(venv_name=venv_name)
        hash_file = self.get_hash_file(venv_path=venv_path)
        python_executable = self.get_python_executable(venv_path=venv_path)
        
        # Install libraries
        libraries: set = set(libraries)

        predefined_libraries = {"/home/user/root/app/shared/dotdict"}
        libraries.update(predefined_libraries)

        lib_hash = self._calculate_hash(libraries)
        hash_changed = self._hash_changed(lib_hash=lib_hash, hash_file=hash_file)

        if hash_changed:
            logger.info("Installing libraries...")
            # removing
            if venv_path.exists():
                await self.remove_venv(venv_name=venv_name)

            await self.create_venv(venv_name=venv_name)

            lib_string = " ".join(libraries)
            stdout, stderr = await execute_command(
                f"{python_executable} -m pip install {lib_string}"
            )
            self._update_hash(lib_hash=lib_hash, hash_file=hash_file)

        return await self.library_list(venv_name=venv_name)

    async def library_list(self, venv_name) -> list[str]:
        venv_path = self.get_venv_path(venv_name=venv_name)

        if not self.venv_exists(venv_name=venv_name):
            msg = f"Virtual environment doesn't exist at {venv_path}."
            logger.error(msg)
            raise VenvException(msg)

        logger.info(f"Getting virtual environment from {venv_path}...")

        stdout, stderr = await execute_command(
            command=f"{sys.executable} -m pip freeze"
        )

        libraries = []
        for line in stdout.split("\n"):
            line = line.strip()
            libraries.append(line)
        return libraries

    # def _get_backup_path(self, venv_name: str) -> Path:
    #     return self._get_venv_path(f"{venv_name}_backup")

    # def _backup_venv(self, venv_name: str)-> None:
    #     venv_path = self._get_venv_path(venv_name)
    #     backup_path = self._get_backup_path(venv_name)
    #     if backup_path.exists():
    #         shutil.rmtree(backup_path)
    #     shutil.copytree(venv_path, backup_path)

    # def _restore_backup(self, venv_name: str) -> None:
    #     venv_path = self._get_venv_path(venv_name)
    #     backup_path = self._get_backup_path(venv_name)
    #     if venv_path.exists():
    #         shutil.rmtree(venv_path)
    #     if backup_path.exists():
    #         shutil.move(backup_path, venv_path)

    # def _cleanup_backup(self, venv_name: str):
    #     backup_path = self._get_backup_path(venv_name)
    #     if backup_path.exists():
    #         shutil.rmtree(backup_path)
