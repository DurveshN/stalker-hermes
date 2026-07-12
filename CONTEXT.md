# CONTEXT.md — Stalker Hermes

Living context doc. Update at the end of every session / significant change.

## What this is
An **AI agency** (Track 03) that continuously tracks a company's competitors across
LinkedIn, X/Twitter, news, blogs, and SEO/website changes — replacing a human
competitive-intelligence analyst. A **manager agent** plans and delegates to
**specialist agents**, each powered by **Linkup** web search. Findings are deduped,
scored for relevance/threat, written to **Convex** (live app state) and **Azure
Postgres** (analytical history), and high-severity items are escalated to **Telegram**
as text + **ElevenLabs** voice notes. Runs **hourly via Hermes cron** and **on-demand**.

## Hackathon framing
- **Primary track:** 03 · AI as Agency (base 164 + overflow).
- **Eligibility:** Hermes is the base harness — Telegram control surface, Hermes cron
  trigger, Hermes memory. Also built *with* Hermes/Codex (keep session receipts).
- **Power-ups (+150):** Linkup, Convex, Cloudflare, ElevenLabs, Dodo, Wispr Flow.
- **Cross-track (+50 cap):** launch post (Virality) + Dodo Pro signups/revenue (Revenue).

## Infra (verified 2026-07-12)
- Azure sub `92ecea33-...`, RG **`hermes-agent`**, region **centralindia**.
- VM **`hermes`** — `98.70.29.145`, Ubuntu 24.04, Standard_B2as_v2 (2vCPU/8GB).
  Only port 22 (SSH) open. SSH key: `~/Downloads/hermes_key.pem`, user `azureuser`.
- Hermes running: `hermes_cli.main gateway run`. Model `gpt-5.5` via `openai-codex`.
  Telegram gateway live. Web backend currently `exa` (we add Linkup separately).
- `$HERMES_HOME = ~/.hermes` on the VM. Cron via `hermes cron add`.

## Key architecture decisions
- **Trigger bus = Convex `runQueue`.** VM has no inbound ports, so every trigger
  (Hermes cron, Telegram cmd, dashboard, CF cron) *enqueues* a row; the orchestrator
  on the VM subscribes via `ConvexClient.onUpdate` and claims/executes jobs.
- **Dual store:** Convex = hot reactive state + trace events (dashboard reads live).
  Postgres = append-only warehouse (raw Linkup JSONB, findings history, SEO time-series).
- **Orchestrator LLM:** Vercel AI SDK + Claude. Manager/synthesis `claude-sonnet-5`,
  specialists `claude-haiku-4-5` (fast/cheap → cost-latency parameter).
- **Observability is first-class:** every manager plan, specialist call, Linkup query,
  and LLM call emits a trace event (parent/child, tokens, cost, status) → trace tree,
  run diff, alerts, cross-run search in the dashboard.

## Repo layout
- `convex-backend/` — Convex schema + functions + runQueue (main backend).
- `orchestrator/` — Node/TS agent crew, runs on the VM as a systemd service.
- `dashboard/` — React/Vite observability + management UI → Cloudflare Pages.
- `landing/` — landing page + signup→Convex + Dodo Pro checkout → Cloudflare Pages.
- `workers/` — Cloudflare Worker: on-demand trigger, Dodo webhook, CF cron backup.
- `hermes/` — Hermes SKILL.md + cron definitions + setup notes.
- `infra/` — Azure Postgres provisioning + VM deploy scripts.

## Status log
- 2026-07-12: Repo scaffolded. Architecture locked.
- 2026-07-12: Full build complete + typechecked (0 real errors; remaining are
  `_generated` stub artifacts that codegen resolves). Orchestrator module chain
  smoke-tested clean. Shipped:
  - convex-backend: schema + competitors/trackers/runQueue/runs/traces/findings/
    alerts/evals/feedback/signups/files.
  - orchestrator: config+pricing, llm (Claude via AI SDK v7), linkup v3 wrapper,
    postgres warehouse, tracer, 3-layer memory, manager + 5 specialists +
    dynamic sub-specialist, runCrew, runQueue subscriber (index), runOnce CLI,
    ElevenLabs voice + Telegram escalation, eval set + CI gate + closed loop.
  - dashboard: runs, trace tree + per-agent cost, run diff, alerts (voice),
    cross-run search, competitor/tracker management UI, eval trend.
  - workers: on-demand trigger + signup + Dodo webhook + CF cron.
  - landing: signup→Convex + Dodo Pro checkout.
  - hermes: stalker SKILL.md + stalker.mjs helper (anyApi).
  - infra: provision-postgres.sh, deploy-orchestrator.sh, setup-hermes-cron.sh.
  - `convex-backend` marked `"type":"module"`; `_generated/` has an anyApi
    runtime fallback (codegen overwrites with typed refs).
- NEXT (needs user creds): run `npx convex dev` (Convex login) → CONVEX_URL;
  add LINKUP + ELEVENLABS keys + Telegram chat id; provision Postgres; fill
  orchestrator/.env; deploy orchestrator + Hermes cron to VM; deploy CF
  worker/dashboard/landing; create Dodo product. Then end-to-end verify a run.
- Env note: ANTHROPIC_API_KEY already present in shell; others not yet set.

## 2026-07-12 — Pivot after brainstorming (Option B) + Next.js landing
- **Product sharpened:** from monitor→brief to an **autonomous analyst** that
  **files the work** — material findings become **GitHub issues/PRs** on
  `DurveshN/stalker-hermes` (action queue), plus Telegram text + ElevenLabs voice.
- **Stack pivot:** orchestrator rewritten in **Python** (`agent/` package) —
  OpenAI (real key, not the VM Codex login), SQLAlchemy + Alembic → Azure Postgres,
  Convex kept as live dashboard mirror. TS `orchestrator/` is now legacy.
- **Store boundary:** Convex owns config (competitors, trackers, evals, feedback,
  signups); Postgres owns produced records (runs, trace_events, findings,
  raw_searches, seo_snapshots, action_items, alerts). Crew mirrors live subset to
  Convex. Findings reference competitor by `competitor_key` (Convex id) + name.
- **Landing:** replaced static HTML with **Next.js 16 + Tailwind 4 + shadcn**
  (ops-console theme, animated intel feed, agency diagram, Telegram sample brief,
  pricing, FAQ, signup→/api/signup→Worker→Convex). Builds clean.
- **Keys:** OPENAI_API_KEY + LINKUP_API_KEY now in root `.env` (verified).
- **GitHub:** gh authed as DurveshN (repo scope); repo exists (empty, public).
- **Decision:** no external observability tool (rubric: homebrewed scores same).
- **Build method:** foundation (config/models/db/convex_client/llm/types/trace/
  memory/store/linkup/alembic) built serially; crew/integrations/evals/(convex+
  dashboard) built by 4 parallel subagents. Integration (pipeline/main/cli) next.
- Design spec: docs/superpowers/specs/2026-07-12-stalker-hermes-design.md.
