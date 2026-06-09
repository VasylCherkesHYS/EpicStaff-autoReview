"""
Agent-service-local constants.
"""

FAILURE_STOP_REASONS: frozenset[str] = frozenset({"llm_error", "timeout"})
"""Stop reasons that indicate a hard loop failure (LLM error or wall-clock timeout)."""
