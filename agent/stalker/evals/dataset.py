"""Eval dataset: hand-curated cases the crew must satisfy on every version.

Seed cases are checked into code (stable baseline). Regression cases are pulled
live from Convex (evals:activeCases) so the team can add reproducers without a
code deploy. See run_evals.load_all_cases for the merge.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EvalCase:
    name: str
    competitor_name: str
    focus: str | None = None
    min_findings: int = 1
    require_source_urls: bool = True
    expect_categories: list[str] = field(default_factory=list)


SEED_CASES: list[EvalCase] = [
    EvalCase(
        name="openai-general",
        competitor_name="OpenAI",
        focus=None,
        min_findings=3,
        require_source_urls=True,
        expect_categories=["product", "funding", "partnership", "hiring"],
    ),
    EvalCase(
        name="anthropic-product-launches",
        competitor_name="Anthropic",
        focus="new model and product launches (Claude releases, API features, pricing tiers)",
        min_findings=2,
        require_source_urls=True,
        expect_categories=["product", "pricing"],
    ),
    EvalCase(
        name="perplexity-funding",
        competitor_name="Perplexity AI",
        focus="funding rounds, valuation, and investor activity",
        min_findings=1,
        require_source_urls=True,
        expect_categories=["funding"],
    ),
    EvalCase(
        name="vercel-positioning",
        competitor_name="Vercel",
        focus="website positioning, landing-page messaging, and marketing changes",
        min_findings=2,
        require_source_urls=True,
        expect_categories=["marketing", "product"],
    ),
]
