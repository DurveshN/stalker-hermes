<div align="center">

# 🕵️ Stalker Hermes

**An AI agency that replaces a competitive-intelligence analyst.**

A crew of AI agents watches your competitors across LinkedIn, X, news, blogs and
SEO — decides what actually matters — and *files the work*: material findings become
**GitHub issues/PRs**, and high-signal moves are briefed to **Slack** as text + voice.
Runs **hourly** and **on-demand**.

Built for the **GrowthX Hermes Buildathon** · Track 03 — AI as Agency.

[Landing](https://stalker-hermes-landing.stalker-hermes.workers.dev) ·
[Repo](https://github.com/DurveshN/stalker-hermes)

</div>

---

## The idea

Every company watches competitors manually — someone skims LinkedIn, catches a
launch on X, forwards a funding article, and (usually) forgets to act on it. Stalker
Hermes runs that job as a **team of agents**:

- a **manager** agent plans each sweep and decides which specialists to run,
- **specialists** (one per channel) search the live web via **Linkup**,
- the manager spawns **deep-dive sub-specialists** when a finding warrants it,
- findings are **deduped, threat-scored**, and the important ones become **GitHub
  issues/PRs** — an action queue a human analyst would own,
- a tight **brief + ElevenLabs voice note** lands in **Slack**.

It's not a monitor that pings you. It's a crew that does the analyst's job and files
the output on real surfaces.

## Try it (in Slack)

```
/stalker track <competitor> | <focus>   → run now; progress streams live into a thread
/stalker runs                           → recent runs with cost + latency
/stalker run <id>                       → brief + findings + filed GitHub actions
/stalker trace <id>                     → the agent trace tree (tokens + cost per step)
/stalker latest <competitor>            → latest findings for one competitor
```

A `track` opens a Slack thread and streams the run in real time:
`📋 Plan → ✓ news: 5 · ✓ product: 10 → 🔬 Spawning deep-dive → 🧠 Synthesizing → brief`.

You can also drive it from **Telegram** (via a Hermes skill) — "track OpenAI",
"latest on Anthropic".

## Architecture

```
 Triggers (each enqueues a Convex runQueue row):
 ┌────────────────────────────────┐        Convex  (config + live mirror)
 │ Hermes cron (hourly, on the VM) │        ┌───────────────────────────────┐
 │ Slack  /stalker                 │─enqueue─▶ competitors · trackers        │
 │ Telegram (Hermes skill)         │        │ runQueue ◀── triggers          │
 │ Cloudflare cron (backup)        │        │ runs · traces · findings       │
 └────────────────────────────────┘        │ actionItems · alerts · signups │
                                            └───────────────────────────────┘
 Python agent (systemd on the VM) ◀── subscribes to runQueue
   manager → [linkedin · x · news · blog · seo · product] specialists (Linkup)
           → dynamic sub-specialists (spawned on notable findings)
           → dedup + threat-score → synthesize brief
   dual-write:  Postgres (source of truth)  +  Convex (live mirror)
   file work:   GitHub issues / PRs (action queue)
   brief:       Slack thread (streamed) + ElevenLabs voice
```

The VM only exposes port 22, so nothing calls *into* it — every trigger drops a row
into the Convex `runQueue` and the agent subscribes. Clean, no inbound ports.

## How the crew works

- **Manager** (`agent/stalker/agents/manager.py`) — reads the request, picks the
  channels worth running (not reflexively all), delegates, reviews the high-severity
  findings, spawns deep-dive sub-specialists when they'd add real intel, decides which
  findings become GitHub work items, and writes the brief.
- **Specialists** (`specialist.py`) — one per channel, each runs a bounded
  tool-calling loop over **Linkup** live search, then extracts structured findings
  (title, url, summary, category, severity, relevance).
- **Sub-specialists** (`subspecialist.py`) — dynamic roles the manager invents at
  runtime (e.g. `funding-arr-deep-dive`) to corroborate or quantify a finding.
- **3-layer memory** — the current run · this competitor's history (dedup) · the
  tracker's rules (channels, depth, spend cap, severity threshold).

## Observability

Every agent/tool/LLM step emits a **trace event** (parent/child, tokens, cost,
latency, status) to Postgres + Convex. `/stalker trace <id>` renders the whole tree
in Slack — manager → specialists → sub-specialists — with **tokens and cost per
step**. A per-run spend cap stops delegation before it overruns.

## Tech stack

| Layer | Choice |
| --- | --- |
| Agent crew | **Python 3.12**, OpenAI `gpt-5.5` (tool-calling + structured output) |
| Live search | **Linkup** (per-specialist web search) |
| Config + live mirror | **Convex** |
| Warehouse | **Azure Postgres** (SQLAlchemy + Alembic) |
| Surface | **Slack** Socket Mode app (commands + streamed briefs) + **ElevenLabs** voice |
| Control / harness | **Hermes** on the VM — Telegram, hourly cron, memory |
| Landing | **Next.js** + Tailwind + shadcn on **Cloudflare** (email+password auth, live signup counter, **Dodo Payments** Pro checkout) |

## Repository layout

| Path | What |
| --- | --- |
| `agent/` | Python agent crew, pipeline, store, Slack app, evals, Alembic. Runs on the VM. |
| `convex-backend/` | Convex schema + functions (config, runQueue, traces, findings, actions, signups/auth). |
| `landing/` | Next.js landing — auth, live signup count, Dodo checkout → Cloudflare. |
| `workers/` | Cloudflare Worker — signup capture, Dodo webhook, backup cron. |
| `hermes/` | Hermes `stalker` skill (Telegram control → Python CLI). |
| `infra/` | Azure Postgres provisioning + VM deploy scripts. |
| `docs/` | Design spec. |

## Run locally

Requires `.env` (see `.env.example`) with `OPENAI_API_KEY`, `LINKUP_API_KEY`,
`CONVEX_URL`, Postgres `PG*`, and Slack tokens.

```bash
cd agent
uv venv && uv pip install -e .
.venv/bin/python -m stalker.cli once "OpenAI" "recent launches"   # one-shot run
.venv/bin/python -m stalker.cli serve                             # queue + Slack daemon
.venv/bin/python -m stalker.evals.run_evals                       # CI eval gate
```

The daemon runs as a systemd service on the VM (`infra/` has the deploy script) and
the Hermes hourly cron enqueues a sweep each hour.

## Track 03 — how it scores

| Parameter (weight) | How it's met |
| --- | --- |
| Real output shipping (20×) | Hourly + on-demand → GitHub issues/PRs + Slack briefs on real surfaces. |
| Observability (7×) | Full trace tree with per-step tokens + cost via `/stalker trace`. |
| Agent org (5×) | Manager plans/delegates per request; spawns sub-specialists dynamically. |
| Evaluation (5×) | Named eval set + CI gate that fails on pass-rate regression. |
| Handoffs / memory (2×) | 3-layer memory passed manager → specialists. |
| Cost / latency (1×) | Bounded specialist loops + per-run spend cap. |
| Management UI (1×) | Define a competitor + tracker role (channels, depth, caps, threshold). |

**Power-ups:** Linkup · Convex · Cloudflare · ElevenLabs · Dodo · Wispr Flow.
**Eligibility:** Hermes is the base harness — Telegram control, hourly cron, memory.

## Notes

- `gpt-5.5` per-token pricing in `agent/stalker/config.py` are placeholders (override
  via `PRICE_IN_*` / `PRICE_OUT_*`); cost *accounting* is structurally correct.
- Secrets live only in `.env` (gitignored). See `.env.example` for the full list.
- The Azure VM + Postgres are torn down post-hackathon; the Cloudflare landing stays
  live (free tier).
