"""run_crew — one full tracking cycle for a competitor.

Ties the crew (manager+specialists) to persistence (Postgres+Convex), the
GitHub action queue, and Telegram/voice escalation. This is the integration
point the queue subscriber, CLI, and evals all call.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from .config import settings
from .memory import Memory, load_memory_by_convex_id, load_memory_by_name
from .trace import Tracer
from .agents.manager import run_manager, ManagerResult
from . import store
from .tools import github
from . import escalate, voice
from .memory import dedup_hash
from .types import sev_rank

MAX_ACTIONS_PER_RUN = 3  # keep the GitHub action queue a triaged shortlist


@dataclass
class RunOutcome:
    run_pg_id: int | None
    run_convex_id: str | None
    new_findings: int = 0
    escalations: int = 0
    actions_filed: int = 0
    findings: list = field(default_factory=list)
    brief: str = ""
    status: str = "succeeded"
    error: str | None = None


def run_crew(
    competitor_key: str | None = None,
    competitor_name: str | None = None,
    trigger: str = "manual",
    focus: str | None = None,
) -> RunOutcome:
    memory = (
        load_memory_by_convex_id(competitor_key, focus)
        if competitor_key
        else load_memory_by_name(competitor_name or "Unknown", focus)
    )
    run_pg_id, run_convex_id = store.start_run(memory, trigger, settings.version)
    tracer = Tracer(run_pg_id, run_convex_id)
    outcome = RunOutcome(run_pg_id=run_pg_id, run_convex_id=run_convex_id)

    try:
        result = run_manager(memory, tracer, run_pg_id)
        outcome.brief = result.brief
        outcome.findings = result.findings
        _persist_and_act(memory, tracer, run_pg_id, run_convex_id, result, outcome)
        if tracer.cost_usd >= memory.spend_cap_usd:
            outcome.status = "partial"
    except Exception as e:  # noqa: BLE001
        outcome.status = "failed"
        outcome.error = str(e)
        tracer.span(agent="pipeline", type="error", label="run_crew failed",
                    status="error", error=str(e))

    store.finish_run(
        run_pg_id, run_convex_id, status=outcome.status,
        tokens_in=tracer.tokens_in, tokens_out=tracer.tokens_out, cost_usd=tracer.cost_usd,
        findings_count=outcome.new_findings, new_count=outcome.new_findings,
        escalations=outcome.escalations, actions_filed=outcome.actions_filed,
        summary=outcome.brief[:2000] if outcome.brief else None, error=outcome.error,
    )
    return outcome


def _persist_and_act(memory: Memory, tracer: Tracer, run_pg_id, run_convex_id,
                     result: ManagerResult, outcome: RunOutcome) -> None:
    # 1) Persist findings (dedup inside store); keep new ones keyed by title.
    new_by_title: dict[str, tuple] = {}  # title.lower() -> (pg_id, convex_id, finding)
    for f in result.findings:
        pg_id, cvx_id, is_new = store.upsert_finding(
            run_pg_id, run_convex_id, memory, f.channel, f
        )
        if is_new:
            outcome.new_findings += 1
            new_by_title[f.title.lower().strip()] = (pg_id, cvx_id, f)

    threshold = memory.escalate_at_severity
    escalate_findings = [
        (pg_id, cvx_id, f)
        for (pg_id, cvx_id, f) in new_by_title.values()
        if sev_rank(f.severity) >= sev_rank(threshold)
    ]

    # 2) File the action queue on GitHub (issues, or PRs for content responses).
    #    Cap per run so the queue stays a triaged shortlist, not issue spam.
    for item in result.actions[:MAX_ACTIONS_PER_RUN]:
        match = _match_finding(item.finding_title, new_by_title)
        if match is None:
            tracer.span(agent="pipeline", type="escalation",
                        label=f"skip action (no matching new finding): {item.title[:60]}")
            continue
        f_pg, f_cvx, _f = match
        if item.kind == "pr":
            slug = github.slugify(item.title)
            res = github.open_pr(
                title=item.title, body=item.body,
                file_path=f"responses/{slug}.md",
                file_content=f"# {item.title}\n\n{item.body}\n",
            )
        else:
            res = github.create_issue(title=item.title, body=item.body,
                                      labels=["competitive-intel"])
        status = "filed" if res.get("ok") else "failed"
        store.save_action(
            run_pg_id, run_convex_id, memory, f_pg, f_cvx,
            kind=item.kind, title=item.title, body=item.body,
            gh_number=res.get("number"), gh_url=res.get("url"), status=status,
        )
        if res.get("ok"):
            outcome.actions_filed += 1
        tracer.span(agent="pipeline", type="escalation",
                    label=f"{item.kind} {status}: {item.title[:50]}",
                    status="ok" if res.get("ok") else "error",
                    output=res.get("url"), error=res.get("error"))

    # 3) Escalate by exception → Telegram text + optional ElevenLabs voice.
    if escalate_findings:
        _escalate(memory, tracer, run_pg_id, run_convex_id, result.brief,
                  escalate_findings, outcome)


def _match_finding(finding_title: str, new_by_title: dict) -> tuple | None:
    key = finding_title.lower().strip()
    if key in new_by_title:
        return new_by_title[key]
    for k, v in new_by_title.items():  # lenient substring match
        if key and (key in k or k in key):
            return v
    return None


def _escalate(memory, tracer, run_pg_id, run_convex_id, brief, escalate_findings, outcome):
    lines = "\n".join(
        f"• *{f.severity.upper()}* [{f.category}] {f.title}" + (f"\n  {f.url}" if f.url else "")
        for (_pg, _cvx, f) in escalate_findings
    )
    header = f"🕵️ *Stalker Hermes* — {memory.competitor}\n{len(escalate_findings)} high-signal update(s):"
    body = f"{header}\n{lines}\n\n{brief[:1500]}"
    delivered: list[str] = []
    if escalate.send_text(body):
        delivered.append("telegram")

    voice_url = None
    if memory.voice_brief:
        audio = voice.synthesize(f"Competitive intelligence update on {memory.competitor}. {brief}")
        if audio:
            voice_url = voice.upload_to_convex(audio)
            if escalate.send_voice_note(audio, f"Intel brief — {memory.competitor}"):
                delivered.append("voice")

    for (f_pg, f_cvx, f) in escalate_findings:
        store.save_alert(run_pg_id, run_convex_id, memory, f_pg, f_cvx,
                         severity=f.severity, message=f.title,
                         delivered_via=delivered, voice_url=voice_url)
        outcome.escalations += 1
    tracer.span(agent="pipeline", type="escalation",
                label=f"escalated {len(escalate_findings)} via {','.join(delivered) or 'none'}")
