"""Tracer — emits one trace event per agent/tool/LLM step to Postgres + Convex.
Owns the run's sequence counter and running token/cost totals. This is the
observability spine: the trace tree is built from (seq, parent_seq), which is
identical in both stores, so no cross-store id mapping is needed."""
from __future__ import annotations

import time
from typing import Any
from . import convex_client as cvx
from .config import cost_usd
from .db import session_scope
from .models import TraceEvent


def _truncate(v: Any, n: int = 4000) -> str | None:
    if v is None:
        return None
    s = v if isinstance(v, str) else str(v)
    return s[:n] + "…[truncated]" if len(s) > n else s


class Tracer:
    def __init__(self, run_pg_id: int | None, run_convex_id: str | None):
        self.run_pg_id = run_pg_id
        self.run_convex_id = run_convex_id
        self._seq = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.cost_usd = 0.0

    def span(
        self,
        agent: str,
        type: str,
        label: str,
        parent_seq: int | None = None,
        status: str = "ok",
        model: str | None = None,
        tokens_in: int = 0,
        tokens_out: int = 0,
        latency_ms: int = 0,
        input: Any = None,
        output: Any = None,
        error: str | None = None,
    ) -> int:
        """Record a span. Returns its seq (pass as a child's parent_seq)."""
        cost = cost_usd(model, tokens_in, tokens_out) if model else 0.0
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out
        self.cost_usd += cost
        seq = self._seq
        self._seq += 1

        with session_scope() as s:
            if s is not None and self.run_pg_id is not None:
                s.add(TraceEvent(
                    run_id=self.run_pg_id, parent_seq=parent_seq, seq=seq, agent=agent,
                    type=type, label=label, status=status, model=model,
                    tokens_in=tokens_in, tokens_out=tokens_out, cost_usd=cost,
                    latency_ms=latency_ms, input=_truncate(input), output=_truncate(output),
                    error=error,
                ))

        if self.run_convex_id:
            cvx.mutation("traces:emit", {
                "runId": self.run_convex_id, "seq": seq, "parentSeq": parent_seq,
                "agent": agent, "type": type, "label": label, "status": status,
                "model": model, "tokensIn": tokens_in, "tokensOut": tokens_out,
                "costUsd": cost, "latencyMs": latency_ms,
                "input": _truncate(input), "output": _truncate(output), "error": error,
            })
        return seq


class Timer:
    """with Timer() as t: ...; t.ms → elapsed milliseconds."""
    def __enter__(self):
        self._start = time.time()
        return self

    def __exit__(self, *a):
        self.ms = int((time.time() - self._start) * 1000)
