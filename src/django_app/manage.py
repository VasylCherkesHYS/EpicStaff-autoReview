#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys
from loguru import logger


def main():
    """Run administrative tasks."""
    src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    sys.path.append(src_path)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_app.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    try:
        execute_from_command_line(sys.argv)
    except Exception as e:
        logger.exception(e)


if __name__ == "__main__":
    main()
