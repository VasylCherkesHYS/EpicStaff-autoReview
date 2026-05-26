"""
Surface sub-package: typed surface items and their resolution into tools / attachments.

The surface payload is the agent's "workspace": the set of tools, RAG
collections, S3 paths, and future item types that are available for a run.
This package owns both the typed item models (``items.py``) and the resolver
machinery (``resolver.py``) that converts them into a ``ToolRegistry`` and a
list of ``ContextAttachment`` objects.
"""

from app.surface.items import RAGItem, S3Item, SurfaceItem, ToolItem
from app.surface.resolver import ItemResolver, SurfaceResolver

__all__ = [
    "SurfaceItem",
    "ToolItem",
    "RAGItem",
    "S3Item",
    "ItemResolver",
    "SurfaceResolver",
]
