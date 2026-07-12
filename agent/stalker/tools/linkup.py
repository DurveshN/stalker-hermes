"""Linkup live-search wrapper (the search power-up doing real work).
Normalizes response shapes across SDK versions to {name,url,content}."""
from __future__ import annotations

from typing import Any
from linkup import LinkupClient

from ..config import settings

_client: LinkupClient | None = None


def _get() -> LinkupClient:
    global _client
    if _client is None:
        _client = LinkupClient(api_key=settings.linkup_api_key)
    return _client


def search_results(
    query: str,
    depth: str = "standard",
    max_results: int = 8,
    from_date: str | None = None,
) -> tuple[list[dict[str, str]], Any]:
    """Run a Linkup searchResults query. Returns (normalized_results, raw)."""
    kwargs: dict[str, Any] = {
        "query": query,
        "depth": depth,
        "output_type": "searchResults",
    }
    raw = _get().search(**kwargs)

    # raw may be an object with `.results`, a dict, or a list.
    items = getattr(raw, "results", None)
    if items is None and isinstance(raw, dict):
        items = raw.get("results", [])
    if items is None and isinstance(raw, list):
        items = raw
    items = items or []

    out: list[dict[str, str]] = []
    for r in items:
        name = _attr(r, "name") or _attr(r, "title") or ""
        url = _attr(r, "url") or ""
        content = _attr(r, "content") or _attr(r, "snippet") or ""
        if url or name:
            out.append({"name": str(name), "url": str(url), "content": str(content)[:1200]})
    return out[:max_results], _to_jsonable(raw)


def _attr(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _to_jsonable(raw: Any) -> Any:
    """Best-effort convert the SDK response to a JSON-serializable structure."""
    if isinstance(raw, (dict, list, str, int, float, bool)) or raw is None:
        return raw
    for meth in ("model_dump", "dict"):
        fn = getattr(raw, meth, None)
        if callable(fn):
            try:
                return fn()
            except Exception:
                pass
    items = getattr(raw, "results", None)
    if items is not None:
        return {"results": [
            {"name": _attr(r, "name"), "url": _attr(r, "url"), "content": _attr(r, "content")}
            for r in items
        ]}
    return {"repr": str(raw)[:5000]}
