"""
Layer 4 — Runner ABC: contract for all run-type-specific orchestrators.

A ``Runner`` subclass owns the control flow for one ``RunType``: it decides
how many times to invoke ``AgentLoop``, how to sequence tasks, and when
execution is complete.  The factory instantiates a runner and an emitter
together; the runner receives both via ``execute``.

Concrete subclasses (``SingleTaskRunner``, ``ListOfTasksRunner``,
``ChatRunner``, ``TeamRunner``) are defined in follow-up plans.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar

from app.emitters.base import Emitter
from app.enums import EmitterMode, RunType
from shared.models.agent_service import AgentRequest


class Runner(ABC):
    """Abstract base for all runner implementations.

    Subclasses must declare two class-level attributes consumed by
    ``RunnerFactory``:

    - ``run_type`` — the ``RunType`` enum value this runner handles.
    - ``emitter_mode`` — the ``EmitterMode`` the factory uses to construct
      the paired ``Emitter``.

    The single abstract method ``execute`` receives a fully-hydrated
    ``AgentRequest`` and the pre-built ``Emitter`` instance.  Subclasses must
    call ``emitter.on_final`` (success path) or let exceptions propagate to
    ``RequestHandler`` which calls ``emitter.on_error``.

    Body to be implemented in follow-up plan — see plan §'What is NOT in this plan'.
    """

    run_type: ClassVar[RunType]
    emitter_mode: ClassVar[EmitterMode]

    @abstractmethod
    async def execute(self, request: AgentRequest, emitter: Emitter) -> None:
        """Execute the agent work described by ``request`` and emit results.

        Subclasses orchestrate 0..N ``AgentLoop`` invocations, feeding each
        with an ``AgentContext`` built from ``request``.  Must call
        ``emitter.on_final`` on success.

        Body to be implemented in follow-up plan — see plan §'What is NOT in this plan'.
        """
        ...
