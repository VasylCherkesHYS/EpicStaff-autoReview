from contextlib import suppress
from pathlib import Path

import environ
from loguru import logger

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
env.read_env(BASE_DIR / ".env")

if env.bool("LOAD_DEBUG_ENV", False):
    logger.info("Load debug environments")
    env.read_env(BASE_DIR.parent / "debug.env", overwrite=True)

from .django import *  # noqa: F401
from .rest import *  # noqa: F401
from .spectacular import *  # noqa: F401
from .jwt import *  # noqa: F401
from .cors import *  # noqa: F401
from .s3_storage import *  # noqa: F401

from .project import *  # noqa: F401

with suppress(ImportError):
    # create settings/local.py for own local settings
    from .local import *  # noqa: F401
