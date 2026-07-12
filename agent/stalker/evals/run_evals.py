"""CI-style eval gate.

    python -m stalker.evals.run_evals            # run + gate on regression
    python -m stalker.evals.run_evals --no-gate  # run + record, never fail

Runs every case through the crew, scores deterministically, records the run to
Convex, and exits non-zero if this version's pass rate regressed vs the previous
recorded run.
"""
from __future__ import annotations

import json
import sys

from .. import convex_client as cvx
from ..config import settings
from .dataset import SEED_CASES, EvalCase
from .scorers import CaseScore, score_case


def _get(obj, key, default=None):
    """Convex returns dicts; tolerate objects too."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def load_all_cases() -> list[EvalCase]:
    """SEED_CASES plus regression cases pulled live from Convex, deduped by name
    (seed wins)."""
    cases: list[EvalCase] = list(SEED_CASES)
    seen = {c.name for c in cases}

    remote = cvx.query("evals:activeCases", {}) or []
    for row in remote:
        if _get(row, "source") != "regression":
            continue
        name = _get(row, "name")
        if not name or name in seen:
            continue
        cases.append(
            EvalCase(
                name=name,
                competitor_name=_get(row, "competitorName", ""),
                focus=_get(row, "focus"),
                min_findings=int(_get(row, "minFindings", 1) or 1),
                require_source_urls=bool(_get(row, "requireSourceUrls", True)),
                expect_categories=list(_get(row, "expectCategories", []) or []),
            )
        )
        seen.add(name)
    return cases


def _run_one(case: EvalCase) -> CaseScore:
    """Execute the crew for one case and score it. A crash scores as a failed
    case rather than aborting the whole suite."""
    from ..pipeline import run_crew  # imported here so a partial env still lists cases

    try:
        outcome = run_crew(
            competitor_name=case.competitor_name,
            trigger="manual",
            focus=case.focus,
        )
    except Exception as e:  # crew crashed → hard fail for this case
        return CaseScore(
            name=case.name,
            passed=False,
            checks={"crew_ran": False},
            detail=f"crashed: {type(e).__name__}: {e}",
        )
    return score_case(case, outcome.findings)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    gate = "--no-gate" not in argv

    cases = load_all_cases()
    print(f"[evals] running {len(cases)} case(s) @ version {settings.version}\n")

    scores: list[CaseScore] = []
    for case in cases:
        score = _run_one(case)
        scores.append(score)
        status = "PASS" if score.passed else "FAIL"
        print(f"  [{status}] {score.name} :: {score.detail}")

    total = len(scores)
    passed = sum(1 for s in scores if s.passed)
    pass_rate = (passed / total) if total else 0.0
    print(f"\n[evals] {passed}/{total} passed (pass_rate={pass_rate:.3f})")

    per_case_scores = [
        {"name": s.name, "passed": s.passed, "checks": s.checks, "detail": s.detail}
        for s in scores
    ]

    # Read the previous run BEFORE recording this one.
    trend = cvx.query("evals:trend", {}) or []
    previous = trend[-1] if trend else None

    cvx.mutation(
        "evals:recordRun",
        {
            "version": settings.version,
            "passed": passed,
            "total": total,
            "details": json.dumps(per_case_scores),
        },
    )

    if gate and previous is not None:
        prev_rate = float(_get(previous, "passRate", 0.0) or 0.0)
        if pass_rate < prev_rate:
            print(
                f"[evals] REGRESSION: pass_rate {pass_rate:.3f} < previous {prev_rate:.3f} "
                f"(version {_get(previous, 'version', '?')}). Failing gate."
            )
            return 1
        print(f"[evals] OK: pass_rate {pass_rate:.3f} >= previous {prev_rate:.3f}.")
    elif gate:
        print("[evals] OK: no previous run to compare against.")
    else:
        print("[evals] gate disabled (--no-gate).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
