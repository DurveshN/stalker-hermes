---
name: stalker
description: Track competitors and read their latest intelligence briefs.
version: 1.0.0
author: stalker-hermes
license: MIT
metadata:
  hermes:
    tags: [competitive-intelligence, tracking, research]
    category: research
---

# Stalker — competitor tracking

Control the Stalker Hermes competitive-intelligence crew from Telegram. This skill
enqueues tracking runs and reads back the latest findings. The actual agent crew
runs as a separate orchestrator service that subscribes to the Convex `runQueue`.

## When to Use

Use when the user asks to track a competitor, trigger a competitor sweep, or see the
latest intel ("what's new with <company>", "track <company> now", "any updates on
competitors").

## Prerequisites

- `CONVEX_URL` available on the VM (exported in the shell or `~/.hermes/.env`).
- The orchestrator service running on the VM (systemd `stalker-orch`).
- `scripts/stalker.mjs` present in this skill directory.

## How to Run

Run the helper with Node (already on the VM via Hermes' bundled node):

- Trigger an on-demand run for one competitor:
  `node scripts/stalker.mjs track "<competitor name>" ["optional focus"]`
- Trigger a sweep of all active competitors:
  `node scripts/stalker.mjs sweep`
- Add a competitor:
  `node scripts/stalker.mjs add "<name>" ["domain.com"]`
- Read the latest findings for a competitor:
  `node scripts/stalker.mjs latest "<competitor name>"`
- List tracked competitors:
  `node scripts/stalker.mjs list`

Report the script's JSON output back to the user in plain language. Escalations and
voice briefs are delivered automatically by the orchestrator; this skill is for
on-demand control and lookups.

## Quick Reference

| Intent | Command |
| --- | --- |
| Track one now | `node scripts/stalker.mjs track "Acme"` |
| Track with focus | `node scripts/stalker.mjs track "Acme" "pricing changes"` |
| Sweep all | `node scripts/stalker.mjs sweep` |
| Add competitor | `node scripts/stalker.mjs add "Acme" "acme.com"` |
| Latest intel | `node scripts/stalker.mjs latest "Acme"` |

## Pitfalls

- A `track`/`sweep` call only *enqueues* work; findings appear once the orchestrator
  finishes the run (usually under a minute). Use `latest` to read results.
- If `CONVEX_URL` is unset the script exits with an error — export it first.

## Verification

`node scripts/stalker.mjs list` should return the tracked competitors as JSON.
