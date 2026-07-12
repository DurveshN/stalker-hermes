"""Slack Socket-Mode app — the product's control + observability surface.

/stalker track <competitor> [| focus]   enqueue a tracking run
/stalker sweep                          track all active competitors
/stalker latest <competitor>            latest findings brief
/stalker runs                           recent runs (cost/latency)
/stalker run <id>                       step through a run's trace tree

Socket Mode → no public URL needed (fits the VM's port-22-only setup).
"""
from __future__ import annotations

from .config import settings
from . import convex_client as cvx
from . import queries, slack_ui

_app = None

_HELP = (
    "*Stalker Hermes* — competitive-intel crew\n"
    "`/stalker track <competitor> | <focus>` — track now (brief lands here)\n"
    "`/stalker sweep` — track all active competitors\n"
    "`/stalker latest <competitor>` — latest findings for one competitor\n"
    "`/stalker runs` — recent runs\n"
    "`/stalker run <id>` — findings + brief + filed actions for a run\n"
    "`/stalker trace <id>` — step through a run's agent trace"
)


def _build_app():
    from slack_bolt import App
    app = App(token=settings.slack_bot_token)

    @app.command("/stalker")
    def stalker(ack, command, respond):
        ack()
        text = (command.get("text") or "").strip()
        parts = text.split(maxsplit=1)
        sub = parts[0].lower() if parts else "help"
        arg = parts[1] if len(parts) > 1 else ""

        if sub == "track" and arg:
            name, _, focus = arg.partition("|")
            _enqueue_track(name.strip(), focus.strip() or None, respond)
        elif sub == "sweep":
            cvx.mutation("runQueue:enqueue", {"trigger": "manual", "requestedBy": "slack"})
            respond("🕵️ Sweeping all active competitors — briefs will land here shortly.")
        elif sub == "latest" and arg:
            f = queries.latest_findings(arg.strip(), limit=8)
            if not f:
                respond(f"No findings yet for *{arg.strip()}*. Try `/stalker track {arg.strip()}`.")
            else:
                respond(blocks=slack_ui.brief_blocks(arg.strip(), f, "", []),
                        text=f"Latest — {arg.strip()}")
        elif sub == "runs":
            runs = queries.recent_runs(8)
            blocks = []
            for r in runs:
                blocks += slack_ui.run_summary_blocks(r)
                blocks.append({"type": "context", "elements": [
                    {"type": "mrkdwn", "text": f"`/stalker run {r['id']}` for findings · `/stalker trace {r['id']}` for the trace"}]})
            respond(blocks=blocks or None, text="Recent runs")
        elif sub == "run" and arg.strip().isdigit():
            rid = int(arg.strip())
            run = queries.run_row(rid)
            if not run:
                respond(f"No run `{rid}`.")
            else:
                respond(blocks=slack_ui.run_detail_blocks(
                    run, queries.run_findings(rid), queries.run_action_links(rid)),
                    text=f"Run {rid} findings")
        elif sub == "trace" and arg.strip().isdigit():
            rid = int(arg.strip())
            run = queries.run_row(rid)
            if not run:
                respond(f"No run `{rid}`.")
            else:
                respond(blocks=slack_ui.trace_blocks(run, queries.run_traces(rid)),
                        text=f"Run {rid} trace")
        elif sub in ("", "help"):
            # Bare /stalker → show the latest findings across all competitors (the value).
            latest = queries.recent_findings_all(10)
            if latest:
                respond(blocks=slack_ui.brief_blocks("Latest intel", latest, "", []),
                        text="Latest intel")
            else:
                respond(_HELP)
        else:
            respond(_HELP)

    return app


def _enqueue_track(name: str, focus: str | None, respond):
    comps = cvx.query("competitors:list", {}) or []
    match = next((c for c in comps if c["name"].lower() == name.lower()), None)
    cid = match["_id"] if match else cvx.mutation("competitors:add", {"name": name})
    cvx.mutation("runQueue:enqueue", {"competitorId": cid, "trigger": "slack",
                                      "requestedBy": "slack", "focus": focus})
    respond(f"🕵️ Tracking *{name}*{f' — focus: _{focus}_' if focus else ''}. Brief incoming.")


def serve_socket() -> None:
    """Blocking: start the Socket Mode handler (run in a thread by main.serve)."""
    from slack_bolt.adapter.socket_mode import SocketModeHandler
    global _app
    _app = _build_app()
    SocketModeHandler(_app, settings.slack_app_token).start()
