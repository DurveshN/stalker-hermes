"""Manager agent — plans the beat, delegates specialists, reviews for depth,
decides what work to file, and writes the brief. It owns the run's strategy;
the specialists own the digging.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from ..config import settings
from ..llm import chat, parse
from ..memory import Memory
from ..trace import Tracer, Timer
from ..types import (
    ALL_CHANNELS, ChannelFinding, ManagerPlan, SpawnDecision, ActionDecision, sev_rank,
)
from .specialist import run_specialist, _target_line
from .subspecialist import run_sub_specialist


@dataclass
class ManagerResult:
    planned_channels: list[str]
    findings: list[ChannelFinding]
    brief: str
    actions: list = field(default_factory=list)


def _as_channel_findings(output, channel: str) -> list[ChannelFinding]:
    return [ChannelFinding(**f.model_dump(), channel=channel) for f in output.findings]


def _findings_digest(findings: list[ChannelFinding]) -> str:
    if not findings:
        return "(no findings)"
    return "\n".join(
        f"[{f.severity}] ({f.channel}/{f.category}) {f.title} — {f.summary} <{f.url}>"
        for f in findings
    )


def run_manager(memory: Memory, tracer: Tracer, run_pg_id, on_progress=None) -> ManagerResult:
    # on_progress(text): optional callback for live streaming (e.g. to Slack).
    def progress(msg: str) -> None:
        if on_progress:
            try:
                on_progress(msg)
            except Exception:
                pass

    allowed = [c for c in memory.channels if c in ALL_CHANNELS]
    if not allowed:
        allowed = list(ALL_CHANNELS)

    # ---- PLAN ---------------------------------------------------------------
    root_seq = tracer.span(
        agent="manager", type="manager_plan", label=f"plan: {memory.competitor}",
        status="running",
    )
    focus_line = f"This request's focus: {memory.focus}. Bias the plan toward it.\n" if memory.focus else ""
    recent = memory.recent_titles[:15]
    recent_line = ("Recently reported (deprioritize beats already well-covered here):\n- "
                   + "\n- ".join(recent) + "\n") if recent else ""
    plan_msgs = [
        {"role": "system", "content": (
            f"You are the lead analyst running competitive intel on {_target_line(memory)}. "
            f"Available channels: {allowed}. Pick the channels worth dispatching for THIS "
            "request — not reflexively all of them. Choose where signal is most likely given the "
            "focus and what's already known. Justify each pick in one sharp line."
        )},
        {"role": "user", "content": f"{focus_line}{recent_line}Select the channels to run now."},
    ]
    with Timer() as t:
        plan, tin, tout = parse(settings.manager_model, plan_msgs, ManagerPlan)
    planned = [s.channel for s in plan.selected if s.channel in allowed]
    if not planned:
        planned = allowed
    tracer.span(
        agent="manager", type="manager_plan", label="plan: selected channels",
        parent_seq=root_seq, model=settings.manager_model,
        tokens_in=tin, tokens_out=tout, latency_ms=t.ms,
        output=f"{planned} :: {plan.rationale}",
    )
    progress(f"📋 Plan: dispatching *{len(planned)}* specialists — {', '.join(planned)}")

    # ---- DELEGATE -----------------------------------------------------------
    findings: list[ChannelFinding] = []
    batch_size = max(1, settings.max_parallel_specialists)
    stopped = False
    for i in range(0, len(planned), batch_size):
        if tracer.cost_usd >= memory.spend_cap_usd:
            tracer.span(
                agent="manager", type="delegate", label="Budget cap reached",
                parent_seq=root_seq, status="error",
                error=f"cost {tracer.cost_usd:.4f} >= cap {memory.spend_cap_usd:.4f}",
            )
            stopped = True
            break
        batch = planned[i:i + batch_size]

        def _one(channel: str):
            delegate_seq = tracer.span(
                agent="manager", type="delegate", label=f"delegate → {channel}",
                parent_seq=root_seq,
            )
            out = run_specialist(channel, memory, tracer, delegate_seq, run_pg_id)
            return channel, out

        with ThreadPoolExecutor(max_workers=len(batch)) as pool:
            for channel, out in pool.map(_one, batch):
                n = len(out.findings)
                findings.extend(_as_channel_findings(out, channel))
                progress(f"✓ {channel}: {n} finding{'s' if n != 1 else ''}")

    # ---- REVIEW + SPAWN -----------------------------------------------------
    notable = [f for f in findings if sev_rank(f.severity) >= sev_rank("high")]
    if notable and not stopped and tracer.cost_usd < memory.spend_cap_usd:
        spawn_msgs = [
            {"role": "system", "content": (
                f"You are the lead analyst on {_target_line(memory)}. Below are the high-severity "
                "findings from this run. Decide if any deserve a dedicated deep-dive sub-specialist "
                "to corroborate, quantify, or trace to primary sources. Spawn AT MOST 2, and only "
                "when a deeper pass would add real intelligence — otherwise spawn none. Name each "
                "role in kebab-case (e.g. funding-deep-dive) with a precise focus."
            )},
            {"role": "user", "content": f"HIGH-SEVERITY FINDINGS:\n{_findings_digest(notable)}"},
        ]
        with Timer() as t:
            spawn, tin, tout = parse(settings.manager_model, spawn_msgs, SpawnDecision)
        tracer.span(
            agent="manager", type="manager_plan", label="review: spawn decision",
            parent_seq=root_seq, model=settings.manager_model,
            tokens_in=tin, tokens_out=tout, latency_ms=t.ms,
            output=", ".join(s.role_name for s in spawn.spawn) or "no spawns",
        )
        for s in spawn.spawn[:2]:
            if tracer.cost_usd >= memory.spend_cap_usd:
                break
            progress(f"🔬 Spawning deep-dive: *{s.role_name}*")
            sub = run_sub_specialist(s.role_name, s.focus, memory, tracer, root_seq, run_pg_id)
            findings.extend(_as_channel_findings(sub, s.role_name))

    # ---- ACTIONS ------------------------------------------------------------
    notable = [f for f in findings if sev_rank(f.severity) >= sev_rank("high")]
    actions: list = []
    if notable:
        action_msgs = [
            {"role": "system", "content": (
                f"You are the lead analyst on {_target_line(memory)}. Turn the high-severity "
                "findings into work items for our team. For each one worth acting on, draft a "
                "GitHub issue (or PR if it's a concrete code/docs change). Title: crisp and "
                "specific. Body (markdown): CONTEXT (what the competitor did, with the source "
                "link), WHY IT MATTERS to us, and a RECOMMENDED ACTION. Skip findings that need "
                "no action. These are decisions only — do not claim they are filed."
            )},
            {"role": "user", "content": f"HIGH-SEVERITY FINDINGS:\n{_findings_digest(notable)}"},
        ]
        with Timer() as t:
            action_decision, tin, tout = parse(settings.manager_model, action_msgs, ActionDecision)
        actions = action_decision.items
        tracer.span(
            agent="manager", type="score", label="decide actions",
            parent_seq=root_seq, model=settings.manager_model,
            tokens_in=tin, tokens_out=tout, latency_ms=t.ms,
            output=f"{len(actions)} action(s)",
        )

    # ---- SYNTHESIZE ---------------------------------------------------------
    synth_msgs = [
        {"role": "system", "content": (
            f"You are the lead analyst on {_target_line(memory)}. Write a tight competitive-intel "
            "brief for a busy founder from the findings below. Lead with the most consequential "
            "move. Be concrete and cite what changed — no hedging, no filler, no restating the "
            "obvious. If nothing material happened, say so plainly in a sentence. Plain prose, "
            "a few short paragraphs max."
        )},
        {"role": "user", "content": (
            f"Focus: {memory.focus or 'general'}\nFINDINGS:\n{_findings_digest(findings)}"
        )},
    ]
    progress("🧠 Synthesizing the brief…")
    with Timer() as t:
        synth = chat(settings.manager_model, synth_msgs)
    tracer.span(
        agent="manager", type="synthesis", label="write brief",
        parent_seq=root_seq, model=synth.model,
        tokens_in=synth.tokens_in, tokens_out=synth.tokens_out, latency_ms=t.ms,
        output=synth.text,
    )

    tracer.span(
        agent="manager", type="manager_plan", label="run complete",
        parent_seq=root_seq, status="ok",
        output=f"{len(findings)} findings, {len(actions)} actions across {planned}",
    )

    return ManagerResult(
        planned_channels=planned, findings=findings, brief=synth.text, actions=actions,
    )
