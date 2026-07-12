# Stalker Hermes — Design Spec

- **Date:** 2026-07-12
- **Status:** Approved (in-chat), building
- **Track:** GrowthX Hermes Buildathon — Track 03 (AI as Agency)
- **Repo:** https://github.com/DurveshN/stalker-hermes.git

## 1. Product

An **autonomous competitive-intelligence analyst**. Not a monitor that pings —
a crew of AI agents that watches competitors, decides what matters, and **files
the work**. Per competitor, hourly + on-demand:

1. **Manager agent** plans which specialists to run based on what changed.
2. **Specialists** (LinkedIn / X / news / blog / SEO / product) search live via **Linkup**.
3. Findings are **deduped vs history, threat-scored**, written to Postgres + Convex.
4. **Action queue:** material findings become **GitHub issues** in
   `DurveshN/stalker-hermes`. When the response is code/content (rebuttal post,
   landing tweak), the crew opens a **PR**.
5. **Escalation:** high-severity → **Telegram text + ElevenLabs voice brief**.

The shipped output is a triaged, sourced action queue — the artifact a human
analyst would own. This is the anti-slop core and the 20x "real output" driver.

## 2. Architecture & topology

- **Python orchestrator** on the Hermes VM (systemd, co-located with Hermes).
  All tool-calling runs here: OpenAI calls, Linkup search, Postgres writes,
  GitHub issue/PR creation.
- **Hermes** = eligibility harness only: Telegram control surface, hourly cron
  trigger, memory. Talks to the orchestrator via the Convex `runQueue`
  (enqueue → subscribe). No inbound VM ports opened.
- **Trigger bus:** Convex `runQueue`. Hermes cron / Telegram / dashboard /
  Cloudflare cron all enqueue; the Python service subscribes and claims jobs.
- **Dual store:** Postgres (SQLAlchemy + Alembic; Azure Flexible, Basic tier,
  RG `hermes-agent`) is the warehouse + battlecard/action-queue state; Convex is
  the reactive store the dashboard reads live (keeps the Convex power-up).
- **Frontends:** dashboard (React/Vite → Cloudflare Pages) reads Convex live;
  landing (Next.js 16 + Tailwind + shadcn, built) → signup→Convex + Dodo later.

## 3. Stack

- **Language:** Python 3.11+ (single stack: crew + DB + GitHub).
- **LLM:** OpenAI API (real key, separate from the VM's Codex login).
  Specialists = `gpt-5.x-mini` tier (cheap/fast → cost-latency parameter);
  manager = a stronger model. Exact per-call token+cost captured for observability.
- **Agents/tools:** OpenAI SDK tool-calling. Tools: `linkup_search`,
  `github_issue`, `github_pr`, plus internal dedup/score/persist steps.
- **DB:** SQLAlchemy 2.x ORM + Alembic migrations. `psycopg` driver.
- **Convex:** mirror the live-read subset via the Python Convex HTTP client.
- **Search:** Linkup (`linkup-sdk` python) — fast/standard/deep depths.
- **Voice:** ElevenLabs TTS → Telegram voice note + durable URL.

## 4. Data model (Postgres via SQLAlchemy/Alembic)

- `competitors` — name, domain, aliases, handles, priority, active.
- `trackers` — role config: channels[], cadence_cron, depth, spend_cap_usd,
  escalate_at_severity, voice_brief, active.
- `runs` — competitor, trigger, status, started/finished, latency_ms,
  tokens_in/out, cost_usd, planned_channels, findings/new counts, escalations,
  summary, version.
- `trace_events` — run_id, parent_id, seq, agent, type, label, status, model,
  tokens_in/out, cost_usd, latency_ms, input/output snapshots. (Observability spine.)
- `findings` — run_id, competitor_id, channel, title, url, summary, category,
  severity, relevance, dedup_hash (unique), published_at, is_new.
- `raw_searches` — run_id, competitor, channel, depth, query, response JSONB.
- `seo_snapshots` — competitor, domain, snapshot JSONB, created_at (time-series).
- `action_items` — finding_id, competitor_id, kind (issue|pr), title, body,
  gh_number, gh_url, status (open|filed|done), created_at.
- `alerts` — run_id, competitor_id, finding_id, severity, message,
  delivered_via[], voice_url, acknowledged.
- `eval_cases` (seed|regression), `eval_runs` (version, pass_rate, details).
- `feedback` — finding_id, verdict (useful|wrong|noise), note.
- `signups` — email, company, plan, dodo ids, first_use_at (landing/Dodo).

Convex mirrors the live-read subset (runs, trace_events, findings, alerts,
action_items, evals, competitors, trackers, runQueue, signups).

## 5. Observability, evals, scoring map

- **Observability (7x → L5):** trace tree (parent_id), token+cost per step,
  per-agent rollup, run diff, failure/cost-spike flags, cross-run search — in our
  own dashboard over Convex/Postgres. No external monitor (rubric: homebrewed
  scores the same at every tier).
- **Evals (5x):** named eval set + CI gate that fails on pass-rate regression;
  "wrong" human feedback becomes a regression eval case (closed loop).
- **Agent org (5x):** manager dynamic-plans, delegates, spawns sub-specialists
  on notable findings (emergent org).
- **Real output (20x):** GitHub issues/PRs on `DurveshN/stalker-hermes` +
  Telegram escalations, hourly + on-demand.
- **Handoffs/memory (2x):** 3-layer memory (current run · competitor history ·
  business rules) passed manager→specialist.
- **Cost/latency (1x):** mini specialists + fast/standard Linkup + per-run cap.
- **Management UI (1x):** dashboard add-competitor + define-tracker-role.

**Power-ups (+150):** Linkup (search core), Convex (live store), Cloudflare
(dashboard/worker/cron), ElevenLabs (voice briefs), Dodo (Pro checkout),
Wispr Flow (dictation during build). Delivery = Telegram (text+voice) + dashboard.

## 6. What is kept vs rebuilt

- **Rebuilt:** the TypeScript `orchestrator/` → Python `agent/` package.
- **Kept:** Convex backend (add `action_items`), dashboard (add action-queue +
  battlecard views), landing (Next.js, done), Cloudflare worker, Hermes skill,
  infra scripts (add Postgres via SQLAlchemy/Alembic init).

## 7. Non-goals

- No external observability SaaS (Langfuse/etc.) — no added score.
- No battlecard-as-primary (Option A) — action queue is primary (Option B).
- Dodo live checkout wired after core loop works.

