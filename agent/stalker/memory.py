"""Three-layer memory the crew uses (Track-03 handoffs & memory):
  1. NOW      — current competitor + focus + tracker config  (from Convex)
  2. HISTORY  — this competitor's past finding titles + dedup hashes (from Postgres)
  3. RULES    — channels, depth, spend cap, severity threshold (from Convex tracker)

Convex owns competitor/tracker config; Postgres owns produced findings. When
Convex is disabled (offline eval/dev), falls back to sensible defaults so a run
can still proceed by competitor name.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from . import convex_client as cvx
from .db import session_scope
from .models import Finding

DEFAULT_CHANNELS = ["linkedin", "twitter", "news", "blog", "seo", "product"]


def dedup_hash(competitor: str, url: str | None, title: str) -> str:
    base = f"{competitor}|{(url or '').split('?')[0].lower()}|{title.lower().strip()}"
    return hashlib.sha1(base.encode()).hexdigest()


@dataclass
class Memory:
    competitor_key: str | None  # Convex id (None in offline fallback)
    competitor: str
    aliases: list[str]
    domain: str | None
    linkedin_url: str | None
    twitter_handle: str | None
    focus: str | None
    recent_titles: list[str] = field(default_factory=list)
    known_hashes: set[str] = field(default_factory=set)
    channels: list[str] = field(default_factory=lambda: list(DEFAULT_CHANNELS))
    depth: str = "standard"
    spend_cap_usd: float = 0.5
    escalate_at_severity: str = "high"
    voice_brief: bool = True


def _history(competitor_name: str) -> tuple[list[str], set[str]]:
    with session_scope() as s:
        if s is None:
            return [], set()
        recent = (
            s.query(Finding)
            .filter(Finding.competitor_name == competitor_name)
            .order_by(Finding.ts.desc())
            .limit(50)
            .all()
        )
        return [f.title for f in recent], {f.dedup_hash for f in recent}


def load_memory_by_convex_id(competitor_key: str, focus: str | None = None) -> Memory:
    """Primary path: config from Convex, history from Postgres."""
    comp = cvx.query("competitors:get", {"id": competitor_key}) or {}
    name = comp.get("name") or "Unknown"
    tracker = cvx.query("trackers:forCompetitor", {"competitorId": competitor_key}) or {}
    titles, hashes = _history(name)
    return Memory(
        competitor_key=competitor_key,
        competitor=name,
        aliases=list(comp.get("aliases") or []),
        domain=comp.get("domain"),
        linkedin_url=comp.get("linkedinUrl"),
        twitter_handle=comp.get("twitterHandle"),
        focus=focus,
        recent_titles=titles,
        known_hashes=hashes,
        channels=list(tracker.get("channels") or DEFAULT_CHANNELS),
        depth=tracker.get("depth") or "standard",
        spend_cap_usd=float(tracker.get("spendCapUsd") or 0.5),
        escalate_at_severity=tracker.get("escalateAtSeverity") or "high",
        voice_brief=bool(tracker.get("voiceBrief", True)),
    )


def load_memory_by_name(name: str, focus: str | None = None) -> Memory:
    """Offline/eval fallback: default config, history from Postgres by name."""
    titles, hashes = _history(name)
    return Memory(
        competitor_key=None,
        competitor=name,
        aliases=[],
        domain=None,
        linkedin_url=None,
        twitter_handle=None,
        focus=focus,
        recent_titles=titles,
        known_hashes=hashes,
    )
