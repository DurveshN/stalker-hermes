"""Channel specialist — one focused analyst per beat (linkedin, news, product…).

Runs a tool-calling loop against Linkup for RECENT developments, then extracts
structured Findings from the evidence. Shared machinery (`_investigate`) is
reused by the dynamic sub-specialists so both behave identically.
"""
from __future__ import annotations

import json
from typing import Any

from ..config import settings
from ..llm import chat, parse
from ..memory import Memory
from ..trace import Tracer, Timer
from ..types import SpecialistOutput, CHANNEL_BRIEF
from ..tools import linkup
from .. import store

_MAX_TURNS = 5

_SEARCH_TOOL = [{
    "type": "function",
    "function": {
        "name": "linkup_search",
        "description": (
            "Run a live web search for recent competitor intelligence. "
            "Issue tight, specific queries (competitor name + the signal you want). "
            "Prefer terms that surface the last ~45 days."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A single focused search query.",
                }
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
}]


def _target_line(memory: Memory) -> str:
    bits = [memory.competitor]
    if memory.aliases:
        bits.append("aka " + ", ".join(memory.aliases))
    if memory.domain:
        bits.append(f"({memory.domain})")
    return " ".join(bits)


def _render(results: list[dict[str, str]]) -> str:
    if not results:
        return "(no results)"
    lines = []
    for r in results:
        lines.append(f"- {r.get('name', '')}\n  URL: {r.get('url', '')}\n  {r.get('content', '')}")
    return "\n".join(lines)


def _urls(results: list[dict[str, str]]) -> str:
    return " | ".join(r.get("url", "") for r in results if r.get("url"))


def _investigate(
    *,
    role_label: str,
    span_type: str,
    system_prompt: str,
    kickoff: str,
    depth: str,
    memory: Memory,
    tracer: Tracer,
    parent_seq: int,
    run_pg_id,
) -> SpecialistOutput:
    """Tool-calling search loop + structured extraction. Returns SpecialistOutput."""
    spec_seq = tracer.span(
        agent=role_label, type=span_type, label=f"{role_label}: investigating",
        parent_seq=parent_seq, status="running",
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": kickoff},
    ]
    evidence: list[dict[str, str]] = []

    for _ in range(_MAX_TURNS):
        with Timer() as t:
            res = chat(
                settings.specialist_model, messages,
                tools=_SEARCH_TOOL, tool_choice="auto",
            )
        tracer.span(
            agent=role_label, type="llm_call", label=f"{role_label}: plan turn",
            parent_seq=spec_seq, model=res.model,
            tokens_in=res.tokens_in, tokens_out=res.tokens_out, latency_ms=t.ms,
            output=(res.text or "")[:500],
        )

        if not res.tool_calls:
            break

        # Echo the assistant turn (with its tool calls) back into the transcript.
        messages.append({
            "role": "assistant",
            "content": res.text or None,
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in res.tool_calls
            ],
        })

        for tc in res.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            query = (args.get("query") or "").strip()
            if not query:
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": "(empty query — skipped)"})
                continue
            try:
                results, raw = linkup.search_results(query, depth=depth, max_results=8)
                store.save_raw_search(run_pg_id, memory.competitor, role_label, depth, query, raw)
                tracer.span(
                    agent=role_label, type="linkup_query",
                    label=f"linkup({depth}): {query[:55]}",
                    parent_seq=spec_seq, output=_urls(results),
                )
                evidence.extend(results)
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": _render(results)})
            except Exception as e:  # search failed — trace + let the model continue
                tracer.span(
                    agent=role_label, type="linkup_query",
                    label=f"linkup FAILED: {query[:55]}",
                    parent_seq=spec_seq, status="error", error=str(e)[:500],
                )
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": f"(search error: {e})"})

    # Extract structured findings from everything we gathered.
    extract_msgs = [
        {"role": "system", "content": (
            f"You are the analyst for {_target_line(memory)}. Extract discrete competitive "
            "findings ABOUT THIS COMPETITOR from the evidence below. Rules: use ONLY URLs that "
            "appear verbatim in the evidence — never invent links. One finding per distinct "
            "development. Deduplicate. Set severity by real competitive threat to us "
            "(critical/high = direct moves against our market; info/low = routine). Ignore "
            "results about other companies. If the evidence shows nothing new or relevant, "
            "return an empty findings list and say so in notes."
        )},
        {"role": "user", "content": f"EVIDENCE:\n{_render(evidence)}"},
    ]
    with Timer() as t:
        output, tin, tout = parse(settings.specialist_model, extract_msgs, SpecialistOutput)
    tracer.span(
        agent=role_label, type="score", label=f"{role_label}: extract findings",
        parent_seq=spec_seq, model=settings.specialist_model,
        tokens_in=tin, tokens_out=tout, latency_ms=t.ms,
        output=f"{len(output.findings)} findings",
    )

    tracer.span(
        agent=role_label, type=span_type, label=f"{role_label}: done",
        parent_seq=parent_seq, status="ok", output=output.notes or f"{len(output.findings)} findings",
    )
    return output


def run_specialist(channel, memory: Memory, tracer: Tracer, parent_seq: int, run_pg_id) -> SpecialistOutput:
    """Dispatch a standing channel specialist for its beat."""
    brief = CHANNEL_BRIEF.get(channel, {"role": f"{channel} tracker", "guidance": ""})
    focus_line = f"\nThis run's focus: {memory.focus}" if memory.focus else ""
    known = memory.recent_titles[:15]
    known_line = ("\nAlready reported (do NOT re-surface these):\n- " + "\n- ".join(known)) if known else ""

    system_prompt = (
        f"You are a {brief['role']} on a competitive-intelligence crew. "
        f"Target: {_target_line(memory)}.\n"
        f"Your beat: {brief['guidance']}{focus_line}{known_line}\n\n"
        "Hunt for developments from the LAST ~45 DAYS on your beat. Use the linkup_search tool "
        "to gather evidence — run 1 to 3 targeted searches, then stop. Do not pad with stale or "
        "generic background. Never fabricate URLs; only trust what search returns."
    )
    kickoff = f"Find what's new for {memory.competitor} on the {channel} beat. Start searching."

    return _investigate(
        role_label=channel, span_type="specialist", system_prompt=system_prompt,
        kickoff=kickoff, depth=memory.depth, memory=memory, tracer=tracer,
        parent_seq=parent_seq, run_pg_id=run_pg_id,
    )
