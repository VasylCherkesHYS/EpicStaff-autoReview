"""
Shared enumerations used across multiple layers of the agent service.

``RunType`` drives ``RunnerFactory`` to select the correct ``Runner`` subclass.
``EmitterMode`` is declared as a class attribute on each ``Runner`` subclass and
tells the factory which ``Emitter`` implementation to construct.
"""

from enum import Enum


class RunType(str, Enum):
    """Execution mode for an agent request.

    ``SINGLE_TASK`` — one prompt, one ``AgentLoop`` invocation.
    ``LIST_OF_TASKS`` — sequential list of prompts, each run through the loop.
    ``CHAT`` and ``TEAM`` are reserved for future runner implementations.
    """

    SINGLE_TASK = "SINGLE_TASK"
    LIST_OF_TASKS = "LIST_OF_TASKS"


class EmitterMode(str, Enum):
    """Output transport strategy declared per ``Runner`` subclass.

    ``BATCH`` — buffer all events, publish a single result envelope on
    ``on_final``.  This is the only mode built in this plan.
    ``STREAM`` — publish LLM delta chunks in real time; reserved for the
    future ``ChatRunner`` and a ``RedisStreamDeltaEmitter`` implementation.
    """

    BATCH = "BATCH"
    STREAM = "STREAM"
