# 🕵️ Stalker Hermes

An **AI agency** that continuously tracks your competitors across LinkedIn, X/Twitter,
news, blogs, and SEO/website changes — then **files the work** so you don't have to.
A **manager agent** plans and delegates to **specialist agents** (one per channel),
each powered by **Linkup** live web search. Findings are deduped, threat-scored, and
stored in **Convex** (live config/mirror) + **Azure Postgres** (durable warehouse).
Material findings become **GitHub issues/PRs** on the tracked repo (an action queue),
and high-severity items escalate to **Slack** as text + **ElevenLabs** voice briefs.
Runs **hourly via Hermes cron** and **on-demand** from Slack.

Built for the GrowthX Hermes Buildathon — **Track 03: AI as Agency**.

## Architecture

```
 Triggers (all enqueue a job):                 Convex (config + live mirror)
 ┌────────────────────────────┐                ┌──────────────────────────────┐
 │ Hermes cron (hourly, VM)    │──┐             │ competitors / trackers        │
 │ Slack /stalker command      │  │  enqueue    │ runQueue  ◄── triggers        │
 │ Cloudflare cron (backup)    │  ├─────────────►│ runs / traces (mirror)        │
 │ stalker CLI (track/sweep)   │  │             │ findings / alerts / evals     │
 └────────────────────────────┘  ┘             └───────────────┬──────────────┘
                                                        subscribe│ (onUpdate)
 Agent (Python crew on the Hermes VM, systemd) ◄────────────────┘
   manager → [linkedin, twitter, news, blog, seo, product] specialists
   → dynamic sub-specialist spawn → synthesis → escalate
   store: Postgres (runs, trace_events, findings, raw_searches, seo_snapshots,
          action_items, alerts) + mirror hot subset to Convex
   escalate → GitHub issues/PRs · Slack text + ElevenLabs voice

 Slack app (Socket Mode): /stalker track|sweep|latest|runs|run|trace — brief +
   findings + GitHub action links; trace = agent tree w/ per-step tokens + cost.
 Landing (Next.js → Cloudflare Pages): signup → Convex, Dodo Pro checkout.
```

Why a Convex `runQueue` bus: the VM only exposes port 22, so instead of opening
inbound ports, every trigger inserts a row and the agent daemon subscribes.

## Repo layout

| Dir | What |
| --- | --- |
| `agent/` | Python agent crew (manager + specialists), tracer, memory, evals, Slack app, CLI. Runs on the VM. |
| `convex-backend/` | Convex schema + functions + runQueue (config + live mirror). |
| `dashboard/` | React/Vite observability UI (kept in repo; Slack is the demo surface). |
| `landing/` | Next.js landing page + signup + Dodo checkout (→ Cloudflare Pages). |
| `hermes/` | Hermes `stalker` skill + helper script. |
| `infra/` | Azure Postgres provisioning + VM agent deploy + Hermes cron setup. |
| `orchestrator/`, `workers/` | Legacy TS orchestrator + Cloudflare Worker (pre-pivot; not the active path). |

## Setup checklist

Do these in order. Steps marked 🔑 need a credential from you.

1. **🔑 Convex** — `cd convex-backend && npx convex dev` (opens browser, creates the
   deployment, generates `_generated/`). Copy the deployment URL → `CONVEX_URL`.
   Leave `convex dev` running, or `npx convex deploy` for prod.
2. **🔑 Linkup** — get an API key at app.linkup.so → `LINKUP_API_KEY`.
3. **🔑 OpenAI** — API key → `OPENAI_API_KEY`.
4. **Azure Postgres** — `bash infra/provision-postgres.sh` → paste the printed
   `PG*` vars into the root `.env`.
5. **🔑 ElevenLabs** — API key + voice id → `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
6. **🔑 Slack** — create a Socket Mode app, install to the workspace, invite the bot
   to your channel; set `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` (+ channel id).
7. **🔑 GitHub** — a token with repo scope + the target repo → `GITHUB_TOKEN`,
   `GITHUB_REPO` (findings become issues/PRs here).
8. **Fill the root `.env`** from `.env.example` with all of the above.
9. **Deploy the agent to the VM** — `KEY=~/Downloads/hermes_key.pem bash infra/deploy-agent.sh`
   (rsyncs `agent/` + `.env`, installs deps via `uv`, runs the `stalker-agent` systemd service).
10. **Install Hermes skill + hourly cron** — `CONVEX_URL=... KEY=... bash infra/setup-hermes-cron.sh`.
11. **🔑 Cloudflare** — `wrangler login`, then deploy the Next.js landing to
    Cloudflare Pages (`cd landing && npm run build && npm run deploy`).
12. **🔑 Dodo Payments** — create the Pro product, wire the checkout link + webhook
    into the landing signup flow.

## Run it

- One-shot locally: `cd agent && stalker once "OpenAI" "recent launches"`.
- Enqueue a run for one competitor: `stalker track "OpenAI" "pricing changes"`.
- Sweep all active competitors: `stalker sweep`.
- Read latest findings: `stalker latest "OpenAI"`.
- Run the daemon (queue subscriber + Slack handler): `stalker serve`.
- On-demand via Slack: `/stalker track "OpenAI"` → the crew runs and the brief
  (findings + GitHub action links) posts back in-channel within a few minutes.

## How this maps to Track 03 scoring

| Parameter (weight) | How we hit it |
| --- | --- |
| Real output shipping (20x) | Hourly + on-demand runs write real findings to Convex/Postgres, **file GitHub issues/PRs**, and escalate by exception to Slack. |
| Agent org structure (5x) | Manager dynamically plans/delegates per request; spawns sub-specialists on notable findings (emergent org). |
| Observability (7x) | Trace tree, per-step tokens+cost, per-agent rollup, run diff, cost/failure signals — surfaced via Slack `trace` + the dashboard. |
| Evaluation & iteration (5x) | Named eval set + CI gate that fails on regression; human "wrong" feedback becomes regression cases (closed loop). |
| Handoffs & memory (2x) | 3-layer memory: current run · competitor history · business rules (tracker config), passed manager→specialist. |
| Cost & latency (1x) | Cheap specialist model + fast/standard Linkup; per-run cost cap guardrail. |
| Management UI (1x) | Non-eng adds a competitor + defines a tracker role (channels/depth/spend cap/severity) — the role definition. |

**Power-ups (+150):** Linkup (search core) · Convex (state) · Cloudflare (Pages) ·
ElevenLabs (voice briefs) · Dodo (Pro checkout) · Wispr Flow (dictation).
**Eligibility:** Hermes is the base harness — Slack/Telegram control surface, hourly
cron trigger, and memory — plus the product was built with Hermes/Codex sessions.
