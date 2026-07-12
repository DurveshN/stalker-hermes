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
        ack()  # must be within 3s — everything below is fast (Postgres reads)

        def show(*, blocks=None, text=None):
            # Post visibly in-channel so nothing looks like it "disappeared".
            respond(response_type="in_channel", blocks=blocks, text=text or "Stalker Hermes")

        def note(text):  # ephemeral (only to the caller) for errors/help
            respond(response_type="ephemeral", text=text)

        raw = (command.get("text") or "").strip()
        parts = raw.split(maxsplit=1)
        sub = parts[0].lower() if parts else ""
        arg = parts[1].strip() if len(parts) > 1 else ""

        try:
            if sub == "track" and arg:
                name, _, focus = arg.partition("|")
                _enqueue_track(name.strip(), focus.strip() or None, show)
            elif sub == "sweep":
                cvx.mutation("runQueue:enqueue", {"trigger": "manual", "requestedBy": "slack"})
                show(text="🕵️ Sweeping all active competitors — briefs will land here shortly.")
            elif sub == "latest" and arg:
                f = queries.latest_findings(arg, limit=8)
                if not f:
                    note(f"No findings yet for *{arg}*. Try `/stalker track {arg}`.")
                else:
                    show(blocks=slack_ui.brief_blocks(arg, f, "", []), text=f"Latest — {arg}")
            elif sub == "runs":
                runs = queries.recent_runs(8)
                if not runs:
                    note("No runs yet. Try `/stalker track OpenAI`.")
                    return
                blocks = []
                for r in runs:
                    blocks += slack_ui.run_summary_blocks(r)
                    blocks.append({"type": "context", "elements": [{"type": "mrkdwn",
                        "text": f"`/stalker run {r['id']}` findings · `/stalker trace {r['id']}` trace"}]})
                show(blocks=blocks, text="Recent runs")
            elif sub in ("run", "trace"):
                if not arg.isdigit():
                    latest_runs = queries.recent_runs(5)
                    ids = ", ".join(f"`{r['id']}`" for r in latest_runs) or "(none yet)"
                    note(f"Usage: `/stalker {sub} <id>`. Recent run ids: {ids}")
                    return
                rid = int(arg)
                run = queries.run_row(rid)
                if not run:
                    note(f"No run `{rid}`. See `/stalker runs`.")
                elif sub == "run":
                    show(blocks=slack_ui.run_detail_blocks(
                        run, queries.run_findings(rid), queries.run_action_links(rid)),
                        text=f"Run {rid} findings")
                else:
                    show(blocks=slack_ui.trace_blocks(run, queries.run_traces(rid)),
                         text=f"Run {rid} trace")
            elif sub in ("", "help"):
                latest = queries.recent_findings_all(10)
                if latest:
                    show(blocks=slack_ui.brief_blocks("Latest intel", latest, "", []),
                         text="Latest intel")
                else:
                    note(_HELP)
            else:
                note(_HELP)
        except Exception as e:  # never leave the user with a silent disappearance
            print(f"[slack] command error: {e}")
            note(f"⚠️ Command failed: {str(e)[:200]}")

    return app


def _enqueue_track(name: str, focus: str | None, show):
    comps = cvx.query("competitors:list", {}) or []
    match = next((c for c in comps if c["name"].lower() == name.lower()), None)
    cid = match["_id"] if match else cvx.mutation("competitors:add", {"name": name})
    cvx.mutation("runQueue:enqueue", {"competitorId": cid, "trigger": "slack",
                                      "requestedBy": "slack", "focus": focus})
    show(text=f"🕵️ Tracking *{name}*{f' — focus: _{focus}_' if focus else ''}. Brief incoming (a few min).")


def serve_socket() -> None:
    """Blocking: start the Socket Mode handler (run in a thread by main.serve)."""
    from slack_bolt.adapter.socket_mode import SocketModeHandler
    global _app
    _app = _build_app()
    SocketModeHandler(_app, settings.slack_app_token).start()
