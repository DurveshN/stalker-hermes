---
name: stalker
description: Track competitors and read their latest competitive intelligence.
version: 2.0.0
author: stalker-hermes
license: MIT
metadata:
  hermes:
    tags: [competitive-intelligence, tracking, research]
    category: research
---

# Stalker — competitor tracking

Control the Stalker Hermes competitive-intelligence crew from Telegram. This skill
shells out to the `stalker` Python CLI on this VM, which enqueues work to Convex; the
`stalker-agent` systemd service runs the crew and delivers briefs to Slack.

## When to Use

Use when the user asks to track a competitor, run a competitor sweep, list tracked
competitors, or see the latest intel ("what's new with <company>", "track <company>",
"any updates on competitors").

## Prerequisites

- `stalker-agent` service running on this VM (it is, via systemd).
- The venv python at `~/stalker-hermes/agent/.venv/bin/python`.

## How to Run

Always invoke through the venv python from the agent directory:

`STALKER=~/stalker-hermes/agent/.venv/bin/python; cd ~/stalker-hermes/agent`

- Track one competitor now (optionally with a focus):
  `$STALKER -m stalker.cli track "<competitor>" "<optional focus>"`
- Sweep all active competitors:
  `$STALKER -m stalker.cli sweep`
- List tracked competitors:
  `$STALKER -m stalker.cli list`
- Read the latest findings for a competitor:
  `$STALKER -m stalker.cli latest "<competitor>"`

The commands return JSON. Summarize it back to the user in plain language. Tracking is
asynchronous — `track`/`sweep` enqueue the run; the full brief is delivered to Slack
(and via any configured Telegram escalation) within a few minutes. Use `latest` to read
results once a run has finished.

## Quick Reference

| Intent | Command |
| --- | --- |
| Track one now | `$STALKER -m stalker.cli track "Acme"` |
| Track with focus | `$STALKER -m stalker.cli track "Acme" "pricing changes"` |
| Sweep all | `$STALKER -m stalker.cli sweep` |
| List tracked | `$STALKER -m stalker.cli list` |
| Latest intel | `$STALKER -m stalker.cli latest "Acme"` |

## Pitfalls

- `track`/`sweep` only *enqueue*; findings appear once the crew finishes (~minutes).
- Run from `~/stalker-hermes/agent` so the CLI loads the repo-root `.env` (CONVEX_URL,
  OPENAI/LINKUP keys, Postgres). The venv python already has all dependencies.

## Verification

`$STALKER -m stalker.cli list` returns the tracked competitors as JSON.
