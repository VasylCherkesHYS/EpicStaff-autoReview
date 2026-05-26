"""
Tools sub-package.

Re-exports ``ToolRegistry`` and ``ToolSpec`` for use by ``SurfaceResolver``
(populates the registry) and ``AgentLoop`` (reads specs, dispatches calls).
"""

from app.tools.registry import ToolRegistry, ToolSpec

__all__ = ["ToolRegistry", "ToolSpec"]
