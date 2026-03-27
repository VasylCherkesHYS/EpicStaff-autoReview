"""Shared logging configuration for the code container.

Two execution contexts require different loguru setups:
- Server (instance_manager.py): stderr + file sinks. stderr goes to docker logs.
- CLI tools (epicstaff_tools.py): file-only sink. stdout/stderr are captured by
  OpenCode and sent to the LLM — loguru MUST NOT write to either stream.
"""

import os
import sys

from loguru import logger

_LOG_DIR_DEFAULT = "/opt/opencode/instances/logs"


def _is_debug_enabled():
    return os.environ.get("DEBUG_LOG", "").lower() in ("true", "1", "yes")


def _log_path():
    return os.environ.get(
        "LOG_FILE_PATH",
        os.path.join(_LOG_DIR_DEFAULT, "epicstaff.log"),
    )


def setup_server_logging():
    """Configure loguru for instance_manager.py: stderr + file sinks."""
    logger.remove()

    level = "DEBUG" if _is_debug_enabled() else "INFO"

    logger.add(
        sys.stderr,
        level=level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level:<8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
    )

    log_path = _log_path()
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    logger.add(
        log_path,
        level="DEBUG",
        rotation="50 MB",
        retention="7 days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} - {message}",
    )

    return logger


def setup_cli_logging():
    """Configure loguru for CLI tools: file-only sink (never stdout/stderr).

    When DEBUG_LOG is disabled, logging is a complete no-op (zero overhead).
    """
    logger.remove()

    if not _is_debug_enabled():
        logger.disable("__main__")
        logger.disable("common")
        logger.disable("flows_read")
        logger.disable("flows_write")
        logger.disable("flows_create")
        logger.disable("tools_read")
        logger.disable("tools_write")
        logger.disable("tools_create")
        logger.disable("projects_read")
        logger.disable("projects_write")
        logger.disable("projects_create")
        logger.disable("log_config")
        return logger

    log_path = _log_path()
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    logger.add(
        log_path,
        level="DEBUG",
        rotation="50 MB",
        retention="7 days",
        compression="gz",
        enqueue=True,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} - {message}",
    )

    return logger
