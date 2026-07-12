"""Deterministic scoring for eval cases.

No LLM in the loop here — every check is reproducible so trend comparisons across
versions are meaningful. The reachability probe is the one non-hermetic check: it
HEAD-requests source URLs to catch hallucinated / dead links.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import httpx

from .dataset import EvalCase

# A finding url must look like a real absolute web URL: scheme + host with a dot.
URL_RE = re.compile(r"^https?://.+\..+", re.IGNORECASE)

_MAX_PROBE = 5
_TIMEOUT = 8.0


@dataclass
class CaseScore:
    name: str
    passed: bool
    checks: dict[str, bool] = field(default_factory=dict)
    detail: str = ""


def urls_resolve(urls: list[str]) -> bool:
    """HEAD-request up to 5 urls (following redirects). Passes only if every
    probed url returns status < 400, tolerating 405 (HEAD not allowed). Any
    dead/invalid link or network error fails the batch — this is what catches
    hallucinated sources."""
    probe = urls[:_MAX_PROBE]
    if not probe:
        return False
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=_TIMEOUT,
            headers={"User-Agent": "stalker-evals/1.0"},
        ) as client:
            for url in probe:
                try:
                    resp = client.head(url)
                except httpx.HTTPError:
                    return False
                if not (resp.status_code < 400 or resp.status_code == 405):
                    return False
    except httpx.HTTPError:
        return False
    return True


def score_case(case: EvalCase, findings: list) -> CaseScore:
    checks: dict[str, bool] = {}
    details: list[str] = []

    n = len(findings)
    checks["min_findings"] = n >= case.min_findings
    details.append(f"findings={n} (min {case.min_findings})")

    if case.require_source_urls:
        urls = [getattr(f, "url", None) for f in findings]
        well_formed = bool(findings) and all(
            u and URL_RE.match(u) for u in urls
        )
        if not well_formed:
            checks["source_urls"] = False
            details.append("source_urls=malformed/missing")
        else:
            reachable = urls_resolve([u for u in urls if u])
            checks["source_urls"] = reachable
            details.append(f"source_urls={'reachable' if reachable else 'dead-link'}")

    if case.expect_categories:
        cats = {getattr(f, "category", None) for f in findings}
        matched = bool(cats & set(case.expect_categories))
        checks["category_match"] = matched
        details.append(
            f"category_match={'yes' if matched else 'no'} "
            f"(got {sorted(c for c in cats if c)})"
        )

    titles = [(getattr(f, "title", "") or "").strip().lower() for f in findings]
    no_dupes = len(titles) == len(set(titles))
    checks["no_dupes"] = no_dupes
    if not no_dupes:
        details.append("no_dupes=duplicate-titles")

    passed = all(checks.values())
    return CaseScore(
        name=case.name,
        passed=passed,
        checks=checks,
        detail="; ".join(details),
    )
