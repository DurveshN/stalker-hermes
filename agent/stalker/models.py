"""SQLAlchemy 2.x models — the Postgres operational warehouse.

Boundary: Convex owns user config (competitors, trackers, evals, feedback,
signups). Postgres owns what the crew *produces* (runs, traces, findings, raw
searches, seo snapshots, action items, alerts). Competitors are referenced by
`competitor_key` (the Convex id string) + `competitor_name`, so the two stores
stay decoupled — no bidirectional entity sync.
"""
from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_key: Mapped[str | None] = mapped_column(String(64), index=True)
    competitor_name: Mapped[str] = mapped_column(String(200), index=True)
    trigger: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="running", index=True)
    convex_id: Mapped[str | None] = mapped_column(String(64), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    planned_channels: Mapped[list] = mapped_column(JSON, default=list)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    new_findings_count: Mapped[int] = mapped_column(Integer, default=0)
    escalations: Mapped[int] = mapped_column(Integer, default=0)
    actions_filed: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String(32), default="v1")


class TraceEvent(Base):
    __tablename__ = "trace_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), index=True)
    parent_seq: Mapped[int | None] = mapped_column(Integer)  # links to sibling seq (both stores)
    seq: Mapped[int] = mapped_column(Integer)
    agent: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="ok")
    model: Mapped[str | None] = mapped_column(String(64))
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    input: Mapped[str | None] = mapped_column(Text)
    output: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), index=True)
    competitor_key: Mapped[str | None] = mapped_column(String(64), index=True)
    competitor_name: Mapped[str] = mapped_column(String(200), index=True)
    channel: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str | None] = mapped_column(String(1000))
    summary: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16), index=True)
    relevance: Mapped[float] = mapped_column(Float, default=0.0)
    dedup_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    published_at: Mapped[str | None] = mapped_column(String(64))
    is_new: Mapped[bool] = mapped_column(Boolean, default=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class RawSearch(Base):
    __tablename__ = "raw_searches"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(index=True)
    competitor_name: Mapped[str] = mapped_column(String(200), index=True)
    channel: Mapped[str] = mapped_column(String(32))
    depth: Mapped[str] = mapped_column(String(16))
    query: Mapped[str] = mapped_column(Text)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SeoSnapshot(Base):
    __tablename__ = "seo_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_name: Mapped[str] = mapped_column(String(200), index=True)
    domain: Mapped[str | None] = mapped_column(String(255))
    snapshot: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ActionItem(Base):
    __tablename__ = "action_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), index=True)
    competitor_key: Mapped[str | None] = mapped_column(String(64), index=True)
    competitor_name: Mapped[str] = mapped_column(String(200))
    finding_id: Mapped[int | None] = mapped_column(ForeignKey("findings.id"))
    kind: Mapped[str] = mapped_column(String(8), default="issue")  # issue | pr
    title: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    gh_number: Mapped[int | None] = mapped_column(Integer)
    gh_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="open")  # open|filed|done|failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), index=True)
    competitor_key: Mapped[str | None] = mapped_column(String(64), index=True)
    competitor_name: Mapped[str] = mapped_column(String(200))
    finding_id: Mapped[int | None] = mapped_column(ForeignKey("findings.id"))
    severity: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    delivered_via: Mapped[list] = mapped_column(JSON, default=list)
    voice_url: Mapped[str | None] = mapped_column(String(1000))
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
