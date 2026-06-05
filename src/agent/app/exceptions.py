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


class UnknownToolRefError(AgentServiceError):
    """Raised when AgentResolver finds a tool_ref not present in request.tools pool."""


class UnknownRagRefError(AgentServiceError):
    """Raised when AgentResolver finds a rag_ref not present in request.rags pool."""


class UnknownS3RefError(AgentServiceError):
    """Raised when AgentResolver finds an s3_ref id not present in request.s3_files pool."""


class DataLoadError(AgentServiceError):
    """Raised when DataLoader cannot fetch or parse the AgentRequest from Redis K/V."""


class DuplicateToolNameError(AgentServiceError):
    """Raised when ToolRegistryBuilder detects a prefixed tool name collision."""
