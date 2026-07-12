"""Dual-write persistence: Postgres (source of truth) + Convex (live mirror).
The crew uses save_raw_search; the pipeline uses the run/finding/action/alert
helpers. Convex mirroring is best-effort and keyed to the competitor's Convex id.
"""
from __future__ import annotations

from datetime import datetime, timezone
from . import convex_client as cvx
from .db import session_scope
from .models import Run, Finding, RawSearch, SeoSnapshot, ActionItem, Alert
from .memory import Memory

# Valid Convex `channel` literals (dynamic sub-specialist channels fold to "product").
_CONVEX_CHANNELS = {"linkedin", "twitter", "news", "blog", "seo", "product"}


def start_run(memory: Memory, trigger: str, version: str) -> tuple[int | None, str | None]:
    """Create the run row (PG) + mirror (Convex). Returns (pg_id, convex_id)."""
    pg_id = None
    with session_scope() as s:
        if s is not None:
            r = Run(
                competitor_key=memory.competitor_key, competitor_name=memory.competitor,
                trigger=trigger, status="running", planned_channels=memory.channels,
                version=version,
            )
            s.add(r)
            s.flush()
            pg_id = r.id
    convex_id = None
    if memory.competitor_key:
        convex_id = cvx.mutation("runs:start", {
            "competitorId": memory.competitor_key, "competitorName": memory.competitor,
            "trigger": trigger, "plannedChannels": memory.channels, "version": version,
        })
    return pg_id, convex_id


def finish_run(pg_id, convex_id, *, status, tokens_in, tokens_out, cost_usd,
               findings_count, new_count, escalations, actions_filed, summary, error=None):
    with session_scope() as s:
        if s is not None and pg_id is not None:
            r = s.get(Run, pg_id)
            if r:
                r.status = status
                r.finished_at = datetime.now(timezone.utc)
                r.latency_ms = int((r.finished_at - r.started_at).total_seconds() * 1000)
                r.tokens_in, r.tokens_out, r.cost_usd = tokens_in, tokens_out, cost_usd
                r.findings_count, r.new_findings_count = findings_count, new_count
                r.escalations, r.actions_filed = escalations, actions_filed
                r.summary, r.error = summary, error
    if convex_id:
        cvx.mutation("runs:finish", {
            "id": convex_id, "status": status, "totalTokensIn": tokens_in,
            "totalTokensOut": tokens_out, "totalCostUsd": cost_usd,
            "findingsCount": findings_count, "newFindingsCount": new_count,
            "escalations": escalations, "summary": summary, "error": error,
        })


def save_raw_search(run_pg_id, competitor_name, channel, depth, query, raw):
    with session_scope() as s:
        if s is not None and run_pg_id is not None:
            s.add(RawSearch(run_id=run_pg_id, competitor_name=competitor_name,
                            channel=channel, depth=depth, query=query, response=raw))


def upsert_finding(run_pg_id, run_convex_id, memory: Memory, channel: str, f) -> tuple[int | None, str | None, bool]:
    """Insert a finding if new (dedup by hash). Returns (pg_id, convex_id, is_new)."""
    from .memory import dedup_hash
    h = dedup_hash(memory.competitor, f.url, f.title)
    if h in memory.known_hashes:
        return None, None, False
    memory.known_hashes.add(h)

    pg_id = None
    with session_scope() as s:
        if s is not None and run_pg_id is not None:
            existing = s.query(Finding).filter(Finding.dedup_hash == h).first()
            if existing:
                return existing.id, None, False
            row = Finding(
                run_id=run_pg_id, competitor_key=memory.competitor_key,
                competitor_name=memory.competitor, channel=channel, title=f.title,
                url=f.url or None, summary=f.summary, category=f.category,
                severity=f.severity, relevance=f.relevance, dedup_hash=h,
                published_at=f.published_at, is_new=True,
            )
            s.add(row)
            s.flush()
            pg_id = row.id
            if channel == "seo":
                s.add(SeoSnapshot(competitor_name=memory.competitor, domain=memory.domain,
                                  snapshot={"title": f.title, "url": f.url, "summary": f.summary}))

    convex_id = None
    if run_convex_id and memory.competitor_key:
        # Convex `channel` is a fixed 6-literal union; dynamic sub-specialist
        # findings carry a role name (e.g. "funding-deep-dive") — fold those to
        # "product" for the mirror. Postgres keeps the real channel above.
        cvx_channel = channel if channel in _CONVEX_CHANNELS else "product"
        res = cvx.mutation("findings:upsert", {
            "runId": run_convex_id, "competitorId": memory.competitor_key, "channel": cvx_channel,
            "title": f.title, "url": f.url or None, "summary": f.summary, "category": f.category,
            "severity": f.severity, "relevance": float(f.relevance), "dedupHash": h,
            "publishedAt": f.published_at,
        })
        convex_id = res.get("id") if isinstance(res, dict) else res
    return pg_id, convex_id, True


def save_action(run_pg_id, run_convex_id, memory: Memory, finding_pg_id, finding_convex_id,
                *, kind, title, body, gh_number, gh_url, status):
    with session_scope() as s:
        if s is not None and run_pg_id is not None:
            s.add(ActionItem(run_id=run_pg_id, competitor_key=memory.competitor_key,
                             competitor_name=memory.competitor, finding_id=finding_pg_id,
                             kind=kind, title=title, body=body, gh_number=gh_number,
                             gh_url=gh_url, status=status))
    if run_convex_id and memory.competitor_key:
        cvx.mutation("actionItems:create", {
            "runId": run_convex_id, "competitorId": memory.competitor_key,
            "findingId": finding_convex_id, "kind": kind, "title": title, "body": body,
            "ghNumber": gh_number, "ghUrl": gh_url, "status": status,
        })


def save_alert(run_pg_id, run_convex_id, memory: Memory, finding_pg_id, finding_convex_id,
               *, severity, message, delivered_via, voice_url=None):
    with session_scope() as s:
        if s is not None and run_pg_id is not None:
            s.add(Alert(run_id=run_pg_id, competitor_key=memory.competitor_key,
                        competitor_name=memory.competitor, finding_id=finding_pg_id,
                        severity=severity, message=message, delivered_via=delivered_via,
                        voice_url=voice_url))
    if run_convex_id and memory.competitor_key:
        cvx.mutation("alerts:create", {
            "runId": run_convex_id, "competitorId": memory.competitor_key,
            "findingId": finding_convex_id, "severity": severity, "message": message,
            "deliveredVia": delivered_via, "voiceUrl": voice_url,
        })
