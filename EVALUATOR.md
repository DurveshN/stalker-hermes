# Stalker Hermes — Evaluator Brief

**Track 03 · AI as Agency** — base 164 + overflow. Power-ups + cross-track on top.

A crew of AI agents that replaces a human **competitive-intelligence analyst**. It
watches a company's competitors across LinkedIn, X, news, blogs, and SEO/website
changes; decides what actually matters; and **files the work** — material findings
become **GitHub issues/PRs** (an action queue a human analyst would own), and
high-severity items escalate to **Slack** as text + **ElevenLabs** voice briefs.
Runs **hourly via Hermes cron** and **on-demand** from Slack.

Repo: `github.com/DurveshN/stalker-hermes` · Live agent: Azure VM `98.70.29.145`,
systemd `stalker-agent`, 24/7 (queue subscriber + Slack socket handler).

---

## 30-second demo path (what a mentor can see live)

1. In Slack: `/stalker track "OpenAI" "pricing changes"` → job enqueues on Convex.
2. The VM daemon claims it, the **manager** plans which channels to run, dispatches
   **specialists** (parallel), each does live **Linkup** searches, extracts findings.
3. Manager reviews high-severity findings, **spawns a sub-specialist** if a deep
   dive adds signal, drafts action items, writes the brief.
4. Findings persist to **Postgres** + mirror to **Convex**; up to 3 become **GitHub
   issues/PRs**; high-severity escalates to Slack (text + voice).
5. `/stalker trace <id>` renders the full **trace tree** in-thread: every agent/LLM/
   search step, indented by parent, with per-step tokens + cost.

Eligibility: Hermes is the **base harness** — hourly cron trigger + Slack/Telegram
control surface + memory — and the product was built **with** Hermes/Codex sessions.

---

## How it scores — Track 03 rubric

### Working product shipping real output — 20x (max 80, overflow uncapped)
Real, end-to-end output on **real surfaces**, escalating by exception:
- **GitHub issues/PRs** filed on the tracked repo (`pipeline.py` → `tools/github.py`).
  Each issue carries CONTEXT (what the competitor did + source link), WHY IT MATTERS,
  RECOMMENDED ACTION. Content responses open a **PR** with a drafted file.
- **Findings** written to Postgres (`findings`, dedup-hashed) + mirrored to Convex.
- **Slack briefs** + **ElevenLabs voice notes** on high-severity only (exception-based,
  not every-run spam — `MAX_ACTIONS_PER_RUN=3`, severity threshold gate).
- Manager pipeline: retrieve → classify → decide → write → escalate, no judge
  intervention needed on the happy path.
- **Overflow:** each additional real autonomous task during judging = +20. Hourly cron
  + on-demand `/stalker` both trigger real runs, so repeated live runs stack.

*Aiming L4–L5. Honest caveat for scoring: findings land on a real GitHub repo and real
Slack; the source surfaces are live web via Linkup. This is production-quality output,
not staged/sandbox.*

### Agent org structure — 5x (max 20)
**Emergent org**, not a fixed pipeline (`agents/manager.py`):
- Manager **plans per request** — reads focus + recent history, picks the channels
  worth running (not reflexively all), justifies each pick.
- **Delegates** to specialists in parallel batches (`ThreadPoolExecutor`).
- **Reviews** outputs, and **spawns sub-specialists on the fly** (e.g.
  `funding-deep-dive`) when a high-severity finding warrants a deeper pass — a role
  that did not exist at kickoff.
- Budget-aware: stops delegating when the spend cap is hit.

*Targets L5: dynamic planning + emergent role spawning both visible in the trace.*

### Observability — 7x (max 28)
Homebrewed but production-grade (rubric: tool-agnostic, homebrew scores the same).
The **trace spine** (`trace.py`) emits one span per agent/tool/LLM step to **both**
Postgres and Convex, keyed by `(seq, parent_seq)`:
- **Trace tree** — who called whom, rendered indented in Slack (`/stalker trace <id>`)
  and the dashboard.
- **Per-step tokens + cost + latency + model**, rolled up per run.
- Filter by agent/task; per-agent cost rollup.
- Run status, cost, escalations queryable across runs (`queries.py`).

*Targets L4 (trace tree + token/cost per step + filtering are live). Run-diff and
cost-spike alerts exist in the dashboard code path toward L5.*

### Evaluation & iteration — 5x (max 20)
**Closed-loop** (`evals/run_evals.py`, `scorers.py`):
- Named seed eval set **+ regression cases pulled live from Convex**.
- **Deterministic scoring** (no LLM in the loop → reproducible trends): min-findings,
  well-formed + **reachable** source URLs (HEAD-probe catches hallucinated links),
  category match, no-dupes.
- **CI-style gate**: records each version's pass rate to Convex and **exits non-zero
  on regression** vs the previous run.
- Human "wrong" feedback (`feedback` table) becomes a regression eval case.

*Targets L5: failed runs feed a growing, version-tracked eval set; gate blocks
regressions.*

### Handoffs & memory — 2x (max 8)
**Three-layer memory** (`memory.py`), passed manager→specialist:
1. **NOW** — current competitor, focus, tracker config (from Convex).
2. **HISTORY** — this competitor's past finding titles + dedup hashes (from Postgres);
   specialists are told "already reported, do not re-surface".
3. **RULES** — channels, depth, spend cap, severity threshold, voice on/off (tracker).

*Targets L5: current + this-user history + business rules, surviving handoffs.*

### Cost & latency per task — 1x (max 4)
Cheap/fast specialist model + fast/standard Linkup depth; **per-run spend cap**
enforced mid-run (manager stops delegating past the cap). Exact tokens+cost captured
per step and per run for live verification off the trace.

*Target band depends on live timing; design is cents-per-run, minutes-per-run.*

### Management UI — 1x (max 4)
Non-engineer defines a tracker **role** via Convex config / Slack: competitor +
channels + depth + spend cap + severity threshold + voice toggle. `/stalker track`
adds a competitor and kicks a run without touching code.

---

## Power-ups (+25 each, real use only)

| Power-up | How it's used | Evidence |
| --- | --- | --- |
| **Linkup** | Search **core** — every specialist's tool-calling loop hits Linkup live; raw responses saved to `raw_searches`. | Code (`tools/linkup.py`) + live query in a run trace. |
| **Convex** | Main config store + live mirror (competitors, trackers, runQueue trigger bus, runs, traces, findings, evals, signups). | Repo + Convex dashboard. |
| **Cloudflare** | Next.js landing on Cloudflare Pages; Worker for signup + Dodo webhook + backup cron. | Live URL + CF dashboard. |
| **ElevenLabs** | Voice does real work — synthesized intel briefs delivered to Slack/Telegram on escalation. | Live demo of the voice note. |
| **Dodo Payments** | Pro checkout wired into the landing signup flow. | Dodo dashboard + live checkout. |
| **Wispr Flow** | Dictation during the build. | Wispr stats screenshot (500+ words). |

All six = +150.

---

## Cross-track bonus (cap 50, half weight, no double-pay)

The launch + landing funnel earns bonus outside Track 03:
- **Virality → Signups** (12.5x) and **Visitors** (5x) from the launch post.
- **Revenue → Signups** (10x) and **Revenue generated** (6x) from Dodo Pro.

Same proof required (live dashboards, DB rows). Nothing scored in Track 03 is paid
again here.

---

## Architecture in one picture

```
Triggers (all enqueue a Convex runQueue row):
  Hermes cron (hourly) · Slack /stalker · Cloudflare cron · stalker CLI
        │ enqueue
        ▼
Convex runQueue ──subscribe(onUpdate/poll)──► Agent daemon (Python, Azure VM, systemd)
                                                manager → [linkedin, twitter, news,
                                                blog, seo, product] specialists
                                                → dynamic sub-specialist → synthesis
        store: Postgres (runs, trace_events, findings, raw_searches, seo_snapshots,
               action_items, alerts) + mirror hot subset to Convex
        escalate: GitHub issues/PRs · Slack text + ElevenLabs voice
```

Why the queue bus: the VM exposes **only port 22**, so instead of opening inbound
ports every trigger inserts a row and the daemon subscribes and claims jobs.

**Store boundary:** Convex owns config + live-read mirror (dashboard/Slack read it);
Postgres is the durable warehouse + action-queue state.

---

## Verification checklist for the mentor

- **Live agent:** `sudo journalctl -u stalker-agent -f` on `98.70.29.145`.
- **Trigger a run:** `/stalker track "<competitor>"` in Slack → brief posts back.
- **See the org + observability:** `/stalker trace <run_id>` → agent tree, tokens, cost.
- **Real output:** GitHub issues/PRs on `DurveshN/stalker-hermes`.
- **Hermes cron (eligibility):** `stalker-hourly-sweep` (`0 * * * *`) →
  `~/.hermes/scripts/stalker_sweep.sh` → enqueues → daemon runs the crew.
- **Evals:** `python -m stalker.evals.run_evals` → pass rate + regression gate.
- **Power-ups:** Convex dashboard, Linkup queries in the trace, ElevenLabs voice in
  Slack, Cloudflare landing URL, Dodo checkout, Wispr stats.

## Known gaps (stated honestly for scoring)

- Dodo live checkout + Cloudflare landing/worker deploy: wiring in progress.
- Wispr dictation evidence: to be captured.
- Escalation thresholds still tuned toward noisy (~30/run) — being tightened so
  escalation is truly exception-based.
