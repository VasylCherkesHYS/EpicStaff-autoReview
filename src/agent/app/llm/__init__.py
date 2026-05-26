"""
Layer 2 — LLM sub-package.

Re-exports the ``LLMClient`` ABC and the normalized chunk models used by
``AgentLoop`` and ``StopPolicy``.  The concrete LiteLLM-backed implementation
is a follow-up plan and will live as a sibling module here.
"""

from app.llm.client import LLMChunk, LLMClient, ToolCallFragment

__all__ = ["LLMClient", "LLMChunk", "ToolCallFragment"]
