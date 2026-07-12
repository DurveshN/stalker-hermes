# Publish Opus 4.7 migration notes, xhigh guidance, and safety caveats

## CONTEXT
Anthropic’s official Opus 4.7 page and third-party coverage describe Claude Opus 4.7 as a GA flagship with improved software engineering, long-running agentic tasks, instruction following, self-verification, higher-resolution vision, 1M context, 128K output, an `xhigh` effort level, flat $5/$25 per million token pricing, and some reported safety-measure tradeoffs versus Opus 4.6. Sources: https://www.anthropic.com/news/claude-opus-4-7 and https://www.nowadais.com/anthropic-claude-opus-4-7-release-features/

## WHY IT MATTERS
Customers will compare Opus 4.7 directly with 4.6 for coding, vision, agentic workflows, price, and safety profile. We need one canonical migration story that highlights improvements while clearly documenting behavior changes and any safety/system-card caveats.

## RECOMMENDED ACTION
Refresh Opus 4.7 docs and release notes with supported parameters, `xhigh` guidance, 1M/128K limits, benchmark context, migration guidance from Opus 4.6, and a linked safety/system-card note covering known tradeoffs and recommended risk controls.
