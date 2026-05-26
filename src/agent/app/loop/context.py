"""
Layer 3 support — AgentContext: mutable conversation state for one loop run.

``AgentContext`` is created by the ``Runner`` before calling
``AgentLoop.run`` and is mutated in-place by the loop as assistant messages
and tool results are appended.  It is not shared across loop invocations.
"""

from __future__ import annotations

from app.models import AgentConfig, ContextAttachment


class AgentContext:
    """Holds all state the ``AgentLoop`` needs for a single conversation cycle.

    Contains the agent's static configuration (model, system prompt, params),
    any context attachments injected by ``SurfaceResolver`` (e.g. RAG
    snippets), and the growing ``messages`` list that is passed to
    ``LLMClient.chat`` on each iteration.

    ``correlation_id`` is carried through for logging and emitter correlation.
    """

    def __init__(
        self,
        agent_config: AgentConfig,
        attachments: list[ContextAttachment],
        correlation_id: str,
        messages: list[dict] | None = None,
    ) -> None:
        self.agent_config = agent_config
        self.attachments = attachments
        self.correlation_id = correlation_id
        self.messages: list[dict] = messages if messages is not None else []

    def append_message(self, message: dict) -> None:
        """Append a single message dict (OpenAI chat format) to the conversation history."""
        self.messages.append(message)
