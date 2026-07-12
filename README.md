# 🕵️ Stalker Hermes

An **AI agency** that continuously tracks your competitors across LinkedIn, X/Twitter,
news, blogs, and SEO/website changes — and briefs you the moment something matters.
A **manager agent** plans and delegates to **specialist agents** (one per channel),
each powered by **Linkup** live web search. Findings are deduped, threat-scored, stored
in **Convex** + **Azure Postgres**, and high-severity items escalate to **Telegram** as
text + **ElevenLabs** voice briefs. Runs **hourly via Hermes cron** and **on-demand**.

Built for the GrowthX Hermes Buildathon — **Track 03: AI as Agency**.

## Architecture

```
 Triggers (all enqueue a job):                 Convex (main backend, reactive)
 ┌───────────────────────────┐                 ┌──────────────────────────────┐
 │ Hermes cron (hourly, VM)   │──┐              │ competitors / trackers        │
 │ Telegram cmd (Hermes skill)│  │   enqueue    │ runQueue  ◄── triggers        │
 │ Dashboard button           │  ├──────────────►│ runs / traces (observability)│
 │ Cloudflare cron (backup)   │  │              │ findings / alerts / evals     │
 └───────────────────────────┘  ┘              └───────────────┬──────────────┘
                                                        subscribe│ (onUpdate)
 Orchestrator (Node/TS on the Hermes VM, systemd) ◄──────────────┘
   manager → [linkedin, twitter, news, blog, seo, product] specialists
   → dynamic sub-specialist spawn → synthesis → escalate
   dual-write: Convex (hot) + Azure Postgres (raw JSONB / history / SEO series)
   escalate → Telegram text + ElevenLabs voice

 Dashboard (React → Cloudflare Pages): trace tree, per-step cost, run diff,
   alerts, cross-run search, competitor/tracker management, eval trend.
 Landing (Cloudflare Pages): signup → Convex, Dodo Pro checkout.
```

Why a Convex `runQueue` bus: the VM only exposes port 22, so instead of opening
inbound ports, every trigger inserts a row and the orchestrator subscribes.

## Repo layout

| Dir | What |
| --- | --- |
| `convex-backend/` | Convex schema + functions + runQueue (main backend). |
| `orchestrator/` | Agent crew (manager + specialists), tracer, memory, evals. Runs on the VM. |
| `dashboard/` | Observability + management UI (React/Vite → CF Pages). |
| `landing/` | Landing page + signup + Dodo checkout (static → CF Pages). |
| `workers/` | Cloudflare Worker: on-demand trigger, Dodo webhook, CF cron backup. |
| `hermes/` | Hermes `stalker` skill + helper script. |
| `infra/` | Azure Postgres provisioning + VM deploy + Hermes cron setup. |

## Setup checklist

Do these in order. Steps marked 🔑 need a credential from you.

1. **🔑 Convex** — `cd convex-backend && npx convex dev` (opens browser, creates the
   deployment, generates `_generated/`). Copy the deployment URL → `CONVEX_URL`.
   Leave `convex dev` running, or `npx convex deploy` for prod.
2. **🔑 Linkup** — get an API key at app.linkup.so → `LINKUP_API_KEY`.
3. **🔑 Anthropic** — API key → `ANTHROPIC_API_KEY`. (Set real Claude 5 pricing via
   `PRICE_IN_*`/`PRICE_OUT_*` if you want exact cost figures — see `.env.example`.)
4. **Azure Postgres** — `bash infra/provision-postgres.sh` → paste the printed
   `PG*` vars into `orchestrator/.env`.
5. **🔑 ElevenLabs** — API key + voice id → `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
6. **Telegram** — reuse the VM's bot token; set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
   (the Hermes home channel/chat id) so escalations + voice land in the same chat.
7. **Fill `orchestrator/.env`** from `.env.example` with all of the above.
8. **Deploy orchestrator to the VM** — `KEY=~/Downloads/hermes_key.pem bash infra/deploy-orchestrator.sh`.
9. **Install Hermes skill + hourly cron** — `CONVEX_URL=... KEY=... bash infra/setup-hermes-cron.sh`.
10. **🔑 Cloudflare** — `wrangler login`, then:
    - Worker: `cd workers && wrangler secret put CONVEX_URL && wrangler secret put DODO_WEBHOOK_SECRET && npm run deploy`.
    - Dashboard: set `VITE_CONVEX_URL` and `cd dashboard && npm run build && npm run deploy`.
    - Landing: edit `landing/config.js` (worker URL + Dodo link), `cd landing && npm run deploy`.
11. **🔑 Dodo Payments** — create the Pro product, put the checkout URL in
    `landing/config.js`, point the webhook at `<worker>/webhooks/dodo`.
12. **Wispr Flow** — dictate 500+ words while building; keep the stats screenshot.

## Run it

- One-shot locally: `cd orchestrator && npm run once -- "OpenAI" "recent launches"`.
- Evals (CI gate): `npm run orch:evals` (fails on pass-rate regression).
- On-demand via Telegram: message the Hermes bot → it runs `stalker track "<name>"`.
- Watch the dashboard update live as runs execute.

## How this maps to Track 03 scoring

| Parameter (weight) | How we hit it |
| --- | --- |
| Real output shipping (20x) | Hourly + on-demand runs write real findings to Convex/Postgres, escalate by exception to Telegram. |
| Agent org structure (5x) | Manager dynamically plans/delegates per request; spawns sub-specialists on notable findings (emergent org). |
| Observability (7x) | Trace tree, per-step tokens+cost, per-agent rollup, run diff, cost/failure signals, cross-run search — live dashboard. |
| Evaluation & iteration (5x) | Named eval set + CI gate that fails on regression; human "wrong" feedback becomes regression cases (closed loop). |
| Handoffs & memory (2x) | 3-layer memory: current run · competitor history · business rules (tracker config), passed manager→specialist. |
| Cost & latency (1x) | Haiku specialists + fast/standard Linkup; per-run cost cap guardrail. |
| Management UI (1x) | Non-eng adds a competitor + defines a tracker role (channels/depth/spend cap/severity) — the role definition. |

**Power-ups (+150):** Linkup (search core) · Convex (main state) · Cloudflare (Pages +
Worker + cron) · ElevenLabs (voice briefs) · Dodo (Pro checkout) · Wispr Flow (dictation).
**Eligibility:** Hermes is the base harness — Telegram control surface, hourly cron
trigger, and memory — plus the product was built with Hermes/Codex sessions.

> Note: Claude 5-family per-token pricing constants in `orchestrator/src/config.ts` are
> `[Unverified]` placeholders — override via env for exact cost figures.
