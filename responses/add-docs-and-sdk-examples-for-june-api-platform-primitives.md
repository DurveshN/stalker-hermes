# Add docs and SDK examples for June API platform primitives

## CONTEXT
June API updates reportedly added server-side fallbacks, MCP tunnels in research preview, self-hosted sandboxes for Claude Managed Agents, a Rate Limits API, and a billing change so refusals with no generated output are not billed.

Source: <https://fazm.ai/t/anthropic-latest-api-release-notes-2026-06>

## WHY IT MATTERS
These are core platform primitives. Developers need accurate SDK coverage, API references, examples, error semantics, billing semantics, and security guidance, especially for fallbacks and MCP tunnels where behavior can affect reliability, privacy, and cost.

## RECOMMENDED ACTION
Update API docs and SDK examples for `fallbacks`, MCP tunnels, self-hosted sandboxes, Rate Limits API, and no-output refusal billing. Include request/response examples, beta flags, known limitations, security notes, billing examples, and migration guidance for existing retry/fallback implementations.
