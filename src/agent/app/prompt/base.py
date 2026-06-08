from abc import ABC, abstractmethod
from collections.abc import Sequence

from shared.models.agent_service import AgentSpec, ContextAttachment


class PromptBuilder(ABC):
    """Base: shared, cache-stable prompt fragments reused by every run-type builder."""

    def _system_prompt(self, agent: AgentSpec) -> str:
        # STABLE / cacheable prefix — persona + base instructions (+ slot for future static additions).
        return f"{agent.role}\n\n{agent.instructions}"

    def _attachment_messages(
        self, attachments: Sequence[ContextAttachment]
    ) -> list[dict]:
        return [{"role": a.role, "content": a.content} for a in attachments]

    @abstractmethod
    def build(self, agent: AgentSpec, **kwargs) -> list[dict]:
        """Return the initial OpenAI-format message list for one run."""
        ...
