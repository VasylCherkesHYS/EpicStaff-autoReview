from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from string import Template

_PROMPTS_DIR = Path(__file__).parent / "prompts"

_persona_template: Template | None = None
_rich_format: str | None = None


def _load_persona_template() -> Template:
    global _persona_template
    if _persona_template is None:
        text = (_PROMPTS_DIR / "persona.md").read_text(encoding="utf-8")
        _persona_template = Template(text)
    return _persona_template


def _load_rich_format() -> str:
    global _rich_format
    if _rich_format is None:
        _rich_format = (_PROMPTS_DIR / "rich_format.md").read_text(encoding="utf-8")
    return _rich_format


@dataclass
class SystemPromptInputs:
    flow_name: str
    flow_description: str
    today_iso: str
    yesterday_iso: str
    tomorrow_iso: str
    node_summary: str
    nodes_section: str
    subflow_summary: str


def build_system_prompt(inputs: SystemPromptInputs) -> str:
    """Assemble the Flow Assistant persona system prompt from pre-computed inputs."""
    persona = _load_persona_template().substitute(
        flow_name=inputs.flow_name,
        flow_description=inputs.flow_description,
        today_iso=inputs.today_iso,
        yesterday_iso=inputs.yesterday_iso,
        tomorrow_iso=inputs.tomorrow_iso,
        node_summary=inputs.node_summary,
        nodes_section=inputs.nodes_section,
        subflow_summary=inputs.subflow_summary,
    )
    return f"{persona}\n\n{_load_rich_format()}"
