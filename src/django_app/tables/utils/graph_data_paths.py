"""Resolve filesystem paths for GraphRag output artefacts (parquet files).

This module mirrors the path-resolution logic from
`src/knowledge/rag/graph_rag/graph_rag_file_manager.py` for the django_app
deployment. The two services are deployed as separate containers and do
not import each other; they agree on the on-disk layout via a shared
volume + the `GRAPH_DATA_DIR` env var.

The django_app side is read-only — it only needs to *locate* the parquet
files that the knowledge worker writes during indexing.
"""

import os
from pathlib import Path


def _find_src_dir() -> Path:
    """Walk up from this file to locate the project's `src/` directory."""
    for parent in Path(__file__).resolve().parents:
        if parent.name == "src":
            return parent
    return Path.cwd()


def resolve_graph_data_dir() -> Path:
    """Return the base directory under which `graph_rag_{id}/output/` lives.

    Resolution order matches the knowledge worker
    (`GraphRagFileManager._resolve_base_dir`):
      1. `GRAPH_DATA_DIR` env var (Docker volume mount).
      2. `<src>/knowledge/graph_data` (local dev fallback).
    """
    env_dir = os.environ.get("GRAPH_DATA_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    return (_find_src_dir() / "knowledge" / "graph_data").resolve()


def text_units_parquet_path(graph_rag_id: int) -> Path:
    """Absolute path to the `text_units.parquet` file for a given GraphRag."""
    return (
        resolve_graph_data_dir()
        / f"graph_rag_{graph_rag_id}"
        / "output"
        / "text_units.parquet"
    )
