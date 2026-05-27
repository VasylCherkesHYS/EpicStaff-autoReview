"""
Domain exception hierarchy for the agent service.

All exceptions raised by service-layer code descend from
``AgentServiceError`` so callers can catch the entire domain at once or
target specific failure modes.  ``RequestHandler`` maps these onto
``emitter.on_error`` and always acks the stream message to avoid poison-pill
re-delivery.
"""


class AgentServiceError(Exception):
    """Base domain error for the agent service."""


class UnknownRunTypeError(AgentServiceError):
    """Raised when RunnerFactory receives a run_type with no registered runner."""


class UnknownSurfaceItemTypeError(AgentServiceError):
    """Raised when SurfaceResolver encounters an item type with no registered resolver."""


class DataLoadError(AgentServiceError):
    """Raised when DataLoader cannot fetch or parse the AgentRequest from Redis K/V."""


class DuplicateToolNameError(AgentServiceError):
    """Raised when ToolRegistryBuilder detects a prefixed tool name collision."""
