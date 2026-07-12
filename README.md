# 🕵️ Stalker Hermes

An **AI agency** that replaces a human competitive-intelligence analyst. A crew of
agents watches your competitors across LinkedIn, X, news, blogs, and SEO/website
changes, decides what actually matters, and **files the work** — material findings
become **GitHub issues/PRs** (an action queue), and high-severity items escalate to
**Slack** as text + **ElevenLabs** voice briefs. Runs **hourly via Hermes cron** and
**on-demand** from Slack or Telegram.

Built for the GrowthX Hermes Buildathon — **Track 03: AI as Agency**.

- **Landing:** https://stalker-hermes-landing.stalker-hermes.workers.dev
- **Live agent:** Azure VM `98.70.29.145`, systemd `stalker-agent` (24/7)
- **Repo:** https://github.com/DurveshN/stalker-hermes

## How it works

```
 Triggers (all enqueue to a Convex runQueue):
 ┌───────────────────────────────┐          Convex (config + live mirror)
 │ Hermes cron (hourly, on VM)    │          ┌────────────────────────────┐
 │ Slack /stalker or Telegram     │─enqueue─▶│ competitors · trackers      │
 │ Cloudflare cron (backup)       │          │ runQueue ◀── triggers       │
 └───────────────────────────────┘          │ runs · traces · findings    │
                                             │ actionItems · alerts        │
 Python agent (systemd on the VM) ◀──subscribe┘ signups (auth + count)
   manager → [linkedin, x, news, blog, seo, product] specialists (Linkup)
   → dynamic sub-specialists → dedup + threat-score → synthesize
   → dual-write Postgres (source of truth) + Convex (live mirror)
   → file GitHub issues/PRs (action queue) → Slack brief + ElevenLabs voice
```

The VM only exposes port 22, so every trigger inserts a row into the Convex
`runQueue` and the agent subscribes — no inbound ports.

## Stack

- **Agent crew:** Python 3.12, OpenAI `gpt-5.5` (tool-calling + structured output).
- **Search:** Linkup live web search (per specialist).
- **Config + live mirror:** Convex (`cheerful-badger-968`). **Warehouse:** Azure
  Postgres Flexible (`stalker-pg` v18) via SQLAlchemy + Alembic.
- **Surface:** Slack Socket Mode app (`/stalker` commands + Block Kit trace views) +
  ElevenLabs voice; Telegram control via a Hermes skill.
- **Landing:** Next.js 16 + Tailwind 4 + shadcn, on Cloudflare (OpenNext). Email+
  password auth (Convex actions, PBKDF2) + a live reactive signup counter + Dodo
  Payments Pro checkout.
- **Harness:** Hermes on the VM — Telegram control, hourly cron, memory (eligibility).

## Repo layout

| Dir | What |
| --- | --- |
| `agent/` | Python agent crew, pipeline, store, Slack app, evals, Alembic. Runs on the VM. |
| `convex-backend/` | Convex schema + functions (config, runQueue, traces, findings, actions, signups/auth). |
| `landing/` | Next.js landing: auth, live count, Dodo checkout → Cloudflare. |
| `dashboard/` | React/Vite observability dashboard (built; Slack is the primary surface). |
| `workers/` | Cloudflare Worker: on-demand trigger, signup, Dodo webhook, CF cron. |
| `hermes/` | Hermes `stalker` skill (Telegram control → Python CLI). |
| `infra/` | Azure Postgres provisioning + VM deploy scripts. |
| `docs/` | Design spec. |

## Run it

Locally (needs `.env` — see `.env.example`):

```bash
cd agent && uv venv && uv pip install -e .
.venv/bin/python -m stalker.cli once "OpenAI" "recent launches"   # one-shot run
.venv/bin/python -m stalker.cli serve                              # queue + Slack daemon
.venv/bin/python -m stalker.evals.run_evals                        # CI eval gate
```

From Slack: `/stalker track <competitor> | <focus>` · `/stalker runs` ·
`/stalker run <id>` (findings + brief + filed actions) · `/stalker trace <id>`
(agent trace tree with per-step tokens + cost).

From Telegram: message the Hermes bot ("track OpenAI", "latest on Anthropic").

## Track 03 scoring map

| Parameter (weight) | How |
| --- | --- |
| Real output (20x) | Hourly + on-demand → GitHub issues/PRs + Slack briefs on real surfaces. |
| Observability (7x) | `/stalker trace` renders the trace tree with tokens + cost per step; every step persisted. |
| Agent org (5x) | Manager plans/delegates per request; spawns sub-specialists on notable findings. |
| Evaluation (5x) | Named eval set + CI gate that fails on pass-rate regression; feedback → regression cases. |
| Handoffs/memory (2x) | 3-layer memory: current run · competitor history · tracker rules. |
| Cost/latency (1x) | Bounded specialist loops + per-run spend cap. |
| Management UI (1x) | Add competitor + define a tracker role (channels/depth/caps/threshold). |

**Power-ups:** Linkup (search), Convex (backend), Cloudflare (landing + worker + cron),
ElevenLabs (voice briefs), Dodo (Pro checkout), Wispr Flow (dictation). **Cross-track:**
landing signups (email+password, live counter) feed Virality/Revenue.

## Notes

- `gpt-5.5` per-token pricing constants in `agent/stalker/config.py` are `[Unverified]`
  placeholders (override via `PRICE_IN_*`/`PRICE_OUT_*` env) — cost accounting is
  structurally correct.
- Secrets live only in `.env` (gitignored). See `.env.example` for the full list.
