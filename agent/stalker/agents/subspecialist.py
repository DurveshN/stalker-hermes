"""Dynamic sub-specialist — a manager-authored deep dive spun up on demand
when a high-severity finding warrants going deeper (e.g. 'funding-deep-dive').

Same machinery as a channel specialist, but the role is ad-hoc, the depth is
forced to 'deep', and the beat is a single sharp focus the manager wrote.
"""
from __future__ import annotations

from ..memory import Memory
from ..trace import Tracer
from ..types import SpecialistOutput
from .specialist import _investigate, _target_line


def run_sub_specialist(
    role_name: str, focus: str, memory: Memory, tracer: Tracer, parent_seq: int, run_pg_id
) -> SpecialistOutput:
    """Run a focused deep-dive investigation authored by the manager."""
    system_prompt = (
        f"You are a '{role_name}' deep-dive analyst on a competitive-intelligence crew. "
        f"Target: {_target_line(memory)}.\n"
        f"Your single mission: {focus}\n\n"
        "Go deep on exactly this — corroborate it, quantify it, and find the primary sources. "
        "Use the linkup_search tool with sharp, specific queries (run 1 to 3). Prefer the last "
        "~45 days but pull older primary sources if they prove the point. Never fabricate URLs; "
        "only trust what search returns."
    )
    kickoff = f"Investigate deeply: {focus}. Start searching."

    return _investigate(
        role_label=role_name, span_type="subspecialist", system_prompt=system_prompt,
        kickoff=kickoff, depth="deep", memory=memory, tracer=tracer,
        parent_seq=parent_seq, run_pg_id=run_pg_id,
    )
