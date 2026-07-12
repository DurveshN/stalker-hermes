"""Shared Pydantic types + channel definitions used across the crew."""
from __future__ import annotations

from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field

Channel = Literal["linkedin", "twitter", "news", "blog", "seo", "product"]
ALL_CHANNELS: list[Channel] = ["linkedin", "twitter", "news", "blog", "seo", "product"]

SEVERITIES = ["info", "low", "medium", "high", "critical"]


def sev_rank(s: str) -> int:
    return SEVERITIES.index(s) if s in SEVERITIES else 0


class Finding(BaseModel):
    title: str = Field(description="Short headline of the development")
    url: str = Field(description="Source URL — must be a real link from the search results")
    summary: str = Field(description="2-3 sentence factual summary of what happened")
    category: Literal[
        "funding", "product", "hiring", "marketing", "pricing", "partnership", "other"
    ]
    severity: Literal["info", "low", "medium", "high", "critical"] = Field(
        description="Competitive threat level to our business"
    )
    relevance: float = Field(ge=0, le=1, description="0-1 importance/relevance")
    published_at: str | None = Field(default=None, description="ISO date if known")


class SpecialistOutput(BaseModel):
    findings: list[Finding] = Field(default_factory=list)
    notes: str = Field(default="", description="Coverage note, gaps, or anomalies")


class ChannelFinding(Finding):
    channel: str


class ManagerPlan(BaseModel):
    class Selected(BaseModel):
        channel: Channel
        reason: str

    selected: list[Selected] = Field(description="Specialists to dispatch for THIS request")
    rationale: str


class SpawnDecision(BaseModel):
    class Spawn(BaseModel):
        role_name: str = Field(description="kebab-case dynamic role, e.g. funding-deep-dive")
        focus: str = Field(description="the specific thing to investigate deeper")

    spawn: list[Spawn] = Field(default_factory=list)


class ActionDecision(BaseModel):
    """The manager's decision on what work to file for a finding."""
    class Item(BaseModel):
        finding_title: str
        kind: Literal["issue", "pr"] = "issue"
        title: str = Field(description="GitHub issue/PR title")
        body: str = Field(description="Markdown body: context, why it matters, recommended action")

    items: list[Item] = Field(default_factory=list)


CHANNEL_BRIEF: dict[str, dict[str, str]] = {
    "linkedin": {
        "role": "LinkedIn tracker",
        "guidance": "Company page posts, headcount/hiring signals, exec announcements, funding, culture.",
    },
    "twitter": {
        "role": "X/Twitter tracker",
        "guidance": "Recent tweets from company + execs, launches, threads, sentiment, viral moments.",
    },
    "news": {
        "role": "News tracker",
        "guidance": "Press coverage, funding rounds, partnerships, exec moves, legal/regulatory.",
    },
    "blog": {
        "role": "Blog/content tracker",
        "guidance": "Company blog posts, changelogs, engineering posts, thought-leadership.",
    },
    "seo": {
        "role": "SEO/website tracker",
        "guidance": "New landing pages, positioning/messaging changes, target keywords, pricing-page changes.",
    },
    "product": {
        "role": "Product/pricing tracker",
        "guidance": "New features, launches, pricing/tier changes, integrations, deprecations.",
    },
}
