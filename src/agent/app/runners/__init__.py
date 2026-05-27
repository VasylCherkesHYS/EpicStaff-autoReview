"""
Layer 4 — Runners sub-package.

Re-exports ``Runner`` (the ABC) for convenient import by ``RunnerFactory``
and future concrete runner modules.  Concrete implementations
(``SingleTaskRunner``, ``ListOfTasksRunner``, etc.) are follow-up plan work
and will live as sibling modules here.
"""

from app.runners.base import Runner

__all__ = ["Runner"]
