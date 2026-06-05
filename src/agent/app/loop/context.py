"""
AgentContext: mutable conversation state for one loop run.

``AgentContext`` is created by ``AgentResolver`` before calling
``AgentLoop.run`` and is mutated in-place by the loop as assistant messages
and tool results are appended.  It is not shared across loop invocations.
"""

from __future__ import annotations

from shared.models.agent_service import AgentSpec, ContextAttachment


class AgentContext:
    """Holds all state the ``AgentLoop`` needs for a single conversation cycle.

    Contains the agent's static configuration (``AgentSpec``), any context
    attachments (e.g. RAG snippets), and the growing ``messages`` list passed
    to ``LLMClient.chat`` on each iteration.

    On construction, if ``messages`` is empty the system message is seeded
    from ``agent.role`` and ``agent.instructions`` so the LLM receives the
    correct persona on the first call.

    ``correlation_id`` is carried through for logging and emitter correlation.
    """

    def __init__(
        self,
        agent: AgentSpec,
        attachments: list[ContextAttachment],
        correlation_id: str,
        messages: list[dict] | None = None,
    ) -> None:
        self.agent = agent
        self.attachments = attachments
        self.correlation_id = correlation_id
        self.messages: list[dict] = messages if messages is not None else []

        if not self.messages:
            system_content = f"{agent.role}\n\n{agent.instructions}"
            self.messages.append({"role": "system", "content": system_content})

    def append_message(self, message: dict) -> None:
        """Append a single message dict (OpenAI chat format) to the conversation history."""
        self.messages.append(message)
