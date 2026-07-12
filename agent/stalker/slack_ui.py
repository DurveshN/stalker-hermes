"""Block Kit builders — shared by outbound briefs and the /stalker command
views so runs render as an inspectable trace, not just a text blob."""
from __future__ import annotations

from typing import Any

_SEV_EMOJI = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪"}
_STATUS_EMOJI = {"succeeded": "✅", "partial": "🟠", "failed": "🔴", "running": "⏳",
                 "ok": "•", "error": "⚠️"}


def _sec(text: str) -> dict:
    return {"type": "section", "text": {"type": "mrkdwn", "text": text[:2900]}}


def _ctx(text: str) -> dict:
    return {"type": "context", "elements": [{"type": "mrkdwn", "text": text[:2900]}]}


def brief_blocks(competitor: str, findings: list, brief: str, action_links: list[dict]) -> list[dict]:
    """Escalation brief: headline + high-signal findings + filed GitHub actions."""
    blocks: list[dict] = [
        {"type": "header", "text": {"type": "plain_text", "text": f"🕵️ {competitor} — intel brief"}},
    ]
    if findings:
        lines = "\n".join(
            f"{_SEV_EMOJI.get(f.severity,'•')} *{f.severity.upper()}* · _{f.category}_ — {f.title}"
            + (f"\n   <{f.url}|source>" if getattr(f, 'url', None) else "")
            for f in findings[:8]
        )
        blocks.append(_sec(lines))
    if brief:
        blocks.append({"type": "divider"})
        blocks.append(_sec(f"*Analyst brief*\n{brief[:1400]}"))
    if action_links:
        blocks.append({"type": "divider"})
        al = "\n".join(f"• <{a['url']}|#{a['number']} {a['title']}>" for a in action_links if a.get("url"))
        if al:
            blocks.append(_sec(f"*Filed to the action queue*\n{al}"))
    return blocks


def run_summary_blocks(run: dict) -> list[dict]:
    """One run's headline stats (for /stalker runs list rows + run header)."""
    st = run.get("status", "?")
    cost = run.get("totalCostUsd", 0) or 0
    tin = run.get("totalTokensIn", 0) or 0
    tout = run.get("totalTokensOut", 0) or 0
    lat = run.get("latencyMs", 0) or 0
    return [_sec(
        f"{_STATUS_EMOJI.get(st,'•')} *{run.get('competitorName','?')}* · {st}\n"
        f"new findings *{int(run.get('newFindingsCount',0) or 0)}* · "
        f"escalations *{int(run.get('escalations',0) or 0)}* · "
        f"tokens {tin+tout:,} · cost *${cost:.4f}* · {lat/1000:.1f}s"
    )]


def trace_blocks(run: dict, traces: list[dict], limit: int = 40) -> list[dict]:
    """Render the trace tree in-thread: indented by parent_seq depth, with
    per-step model/tokens/cost. This is the observability 'step through a run'."""
    by_seq = {t["seq"]: t for t in traces}

    def depth(t: dict) -> int:
        d, cur = 0, t
        while cur.get("parentSeq") is not None and cur["parentSeq"] in by_seq and d < 8:
            cur = by_seq[cur["parentSeq"]]
            d += 1
        return d

    lines = []
    for t in sorted(traces, key=lambda x: x["seq"])[:limit]:
        ind = "▸ " + "  " * depth(t)
        cost = t.get("costUsd", 0) or 0
        toks = (t.get("tokensIn", 0) or 0) + (t.get("tokensOut", 0) or 0)
        meta = f" · {toks} tok · ${cost:.4f}" if toks else ""
        lines.append(f"{ind}{_STATUS_EMOJI.get(t.get('status'),'•')} `{t['agent']}` {t['type']} — {t['label'][:70]}{meta}")
    header = run_summary_blocks(run)
    body = "\n".join(lines) or "(no trace steps)"
    return header + [{"type": "divider"}, _sec(body)]
