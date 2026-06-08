"""
Layer 4 — Runner ABC: contract for all run-type-specific orchestrators.

A ``Runner`` subclass owns the control flow for one ``RunType``: it decides
how many times to invoke ``AgentLoop``, how to sequence tasks, and when
execution is complete.  The factory instantiates a runner and an emitter
together; the runner receives both via ``execute``.

Concrete subclasses (``SingleTaskRunner``, etc.) live as sibling modules.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

from app.emitters.base import Emitter
from app.enums import EmitterMode, RunType
from shared.models.agent_service import AgentRequest

if TYPE_CHECKING:
    from app.runners.deps import RunnerDependencies


class Runner(ABC):
    """Abstract base for all runner implementations.

    Subclasses must declare two class-level attributes consumed by
    ``RunnerFactory``:

    - ``run_type`` — the ``RunType`` enum value this runner handles.
    - ``emitter_mode`` — the ``EmitterMode`` the factory uses to construct
      the paired ``Emitter``.

    The constructor receives ``RunnerDependencies`` (resolver + loop) so each
    runner has direct access to its collaborators without going through the
    factory again.

    The single abstract method ``execute`` receives a fully-hydrated
    ``AgentRequest`` and the pre-built ``Emitter`` instance.  Subclasses own
    the full emitter lifecycle: ``on_start`` → ``on_final`` | ``on_error``.
    """

    run_type: ClassVar[RunType]
    emitter_mode: ClassVar[EmitterMode]

    def __init__(self, deps: "RunnerDependencies") -> None:
        self._deps = deps

    @abstractmethod
    async def execute(self, request: AgentRequest, emitter: Emitter) -> None:
        """Execute the agent work described by ``request`` and emit results.

        Subclasses orchestrate 0..N ``AgentLoop`` invocations, feeding each
        with an ``AgentContext`` built from ``request``.  Must call
        ``emitter.on_final`` on success or ``emitter.on_error`` on failure.
        """
        ...
