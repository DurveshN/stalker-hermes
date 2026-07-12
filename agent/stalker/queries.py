"""Read queries over Postgres (the source of truth) for Slack/CLI views.
Returns plain dicts / SimpleNamespace so callers don't hold a live session."""
from __future__ import annotations

from types import SimpleNamespace
from sqlalchemy import text
from .db import session_scope


def recent_runs(limit: int = 10) -> list[dict]:
    with session_scope() as s:
        if s is None:
            return []
        rows = s.execute(text(
            "select id, competitor_name, status, new_findings_count, escalations, "
            "cost_usd, tokens_in, tokens_out, latency_ms "
            "from runs order by id desc limit :n"), {"n": limit}).all()
        return [{
            "id": r.id, "competitorName": r.competitor_name, "status": r.status,
            "newFindingsCount": r.new_findings_count, "escalations": r.escalations,
            "totalCostUsd": r.cost_usd, "totalTokensIn": r.tokens_in,
            "totalTokensOut": r.tokens_out, "latencyMs": r.latency_ms,
        } for r in rows]


def run_row(run_id: int) -> dict | None:
    runs = [r for r in recent_runs(200) if r["id"] == run_id]
    return runs[0] if runs else None


def run_traces(run_id: int, limit: int = 200) -> list[dict]:
    with session_scope() as s:
        if s is None:
            return []
        rows = s.execute(text(
            "select seq, parent_seq, agent, type, label, status, tokens_in, tokens_out, cost_usd "
            "from trace_events where run_id=:r order by seq limit :n"),
            {"r": run_id, "n": limit}).all()
        return [{
            "seq": r.seq, "parentSeq": r.parent_seq, "agent": r.agent, "type": r.type,
            "label": r.label, "status": r.status, "tokensIn": r.tokens_in,
            "tokensOut": r.tokens_out, "costUsd": r.cost_usd,
        } for r in rows]


def latest_findings(competitor_name: str, limit: int = 10) -> list[SimpleNamespace]:
    with session_scope() as s:
        if s is None:
            return []
        rows = s.execute(text(
            "select severity, category, title, url from findings "
            "where lower(competitor_name)=lower(:c) order by id desc limit :n"),
            {"c": competitor_name, "n": limit}).all()
        return [SimpleNamespace(severity=r.severity, category=r.category,
                                title=r.title, url=r.url) for r in rows]


def run_action_links(run_id: int) -> list[dict]:
    with session_scope() as s:
        if s is None:
            return []
        rows = s.execute(text(
            "select gh_number, gh_url, title from action_items "
            "where run_id=:r and gh_url is not null order by id"), {"r": run_id}).all()
        return [{"number": r.gh_number, "url": r.gh_url, "title": r.title} for r in rows]
