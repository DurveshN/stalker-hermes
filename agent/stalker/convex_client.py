"""Thin Convex HTTP wrapper. Calls functions by string path via the Python
client's anyApi-style access. No-op safe when Convex isn't configured.

The dashboard reads Convex live; the crew mirrors its hot state here. Postgres
remains the source of truth for history/analytics.
"""
from __future__ import annotations

from typing import Any
from .config import settings

_client = None


def _get():
    global _client
    if _client is None and settings.convex_enabled:
        from convex import ConvexClient  # lazy import
        _client = ConvexClient(settings.convex_url)
    return _client


def mutation(name: str, args: dict[str, Any]) -> Any:
    """Run a Convex mutation by dotted path, e.g. 'runs:start'. Returns None if
    Convex is disabled or the call fails (mirroring is best-effort)."""
    c = _get()
    if c is None:
        return None
    try:
        return c.mutation(_path(name), args)
    except Exception as e:  # never let mirroring break a run
        print(f"[convex] mutation {name} failed: {e}")
        return None


def query(name: str, args: dict[str, Any]) -> Any:
    c = _get()
    if c is None:
        return None
    try:
        return c.query(_path(name), args)
    except Exception as e:
        print(f"[convex] query {name} failed: {e}")
        return None


def _path(name: str) -> str:
    # Accept both "runs.start" and "runs:start"; Convex wants "runs:start".
    return name.replace(".", ":", 1) if "." in name and ":" not in name else name
