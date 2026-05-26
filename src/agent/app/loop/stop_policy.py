"""
Layer 3 support — StopPolicy: pluggable termination strategy for ``AgentLoop``.

The stop policy is the single decision point that tells the loop whether to
perform another LLM call or return.  Runners inject an appropriate policy
when constructing the loop invocation, keeping termination logic out of both
the loop body and the runner.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.llm.client import LLMChunk


class StopPolicy(ABC):
    """Abstract strategy that decides when an ``AgentLoop`` iteration should end.

    ``AgentLoop`` calls ``should_stop`` after each iteration with the current
    index, the chunks received from the LLM, and any tool calls that were
    accumulated.  Subclasses encode domain-specific termination rules.
    """

    @abstractmethod
    def should_stop(
        self,
        iteration_index: int,
        last_chunks: list[LLMChunk],
        last_tool_calls: list,
    ) -> bool:
        """Return ``True`` if the loop should stop after this iteration.

        Args:
            iteration_index: zero-based count of completed iterations.
            last_chunks: all ``LLMChunk`` objects received in this iteration.
            last_tool_calls: tool-call objects accumulated from this iteration's
                chunks.  An empty list means the LLM produced a plain text
                response with no tool use.
        """
        ...


class MaxIterAndNoToolCalls(StopPolicy):
    """Default stop policy: stop when the iteration cap is reached or the
    LLM response contains no tool calls.

    Satisfies the common case: keep looping only while the model is using
    tools; once it returns plain text (or the safety cap is hit), stop.
    ``max_iter`` guards against infinite tool-call chains.
    """

    def __init__(self, max_iter: int) -> None:
        self._max_iter = max_iter

    def should_stop(
        self,
        iteration_index: int,
        last_chunks: list[LLMChunk],
        last_tool_calls: list,
    ) -> bool:
        """Return ``True`` if ``iteration_index >= max_iter`` or no tool calls were made."""
        if iteration_index >= self._max_iter:
            return True

        return not last_tool_calls
