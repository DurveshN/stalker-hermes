"""stalker CLI.

  stalker serve                     run the queue-subscriber daemon
  stalker once "<name>" ["focus"]   one-shot tracking run (local/eval)
  stalker sweep                     enqueue a sweep of all active competitors
  stalker track "<name>" ["focus"]  enqueue a run for one competitor
  stalker latest "<name>"           print latest findings for a competitor
  stalker list                      list tracked competitors
  stalker initdb                    create tables directly (dev bootstrap)
"""
from __future__ import annotations

import sys
import json
from .db import init_db


def _track(name: str, focus: str | None) -> None:
    from . import convex_client as cvx
    comps = cvx.query("competitors:list", {}) or []
    m = next((c for c in comps if c["name"].lower() == name.lower()), None)
    cid = m["_id"] if m else cvx.mutation("competitors:add", {"name": name})
    jid = cvx.mutation("runQueue:enqueue", {
        "competitorId": cid, "trigger": "telegram", "requestedBy": "hermes", "focus": focus})
    print(json.dumps({"tracking": name, "focus": focus, "job": jid,
                      "note": "brief lands in Slack in a few minutes"}))


def _latest(name: str) -> None:
    from .queries import latest_findings
    init_db()
    f = latest_findings(name, limit=8)
    print(json.dumps([{"severity": x.severity, "category": x.category,
                       "title": x.title, "url": x.url} for x in f], indent=2))


def _list() -> None:
    from . import convex_client as cvx
    comps = cvx.query("competitors:list", {}) or []
    print(json.dumps([{"name": c["name"], "active": c.get("active", True)} for c in comps], indent=2))


def main() -> None:
    args = sys.argv[1:]
    cmd = args[0] if args else ""

    if cmd == "serve":
        from .main import serve
        serve()

    elif cmd == "initdb":
        init_db()
        print("tables created")

    elif cmd == "once":
        if len(args) < 2:
            print('usage: stalker once "<competitor name>" ["focus"]')
            sys.exit(1)
        init_db()
        from .pipeline import run_crew
        name, focus = args[1], (args[2] if len(args) > 2 else None)
        outcome = run_crew(competitor_name=name, trigger="manual", focus=focus)
        print(json.dumps({
            "status": outcome.status, "new_findings": outcome.new_findings,
            "actions_filed": outcome.actions_filed, "escalations": outcome.escalations,
            "error": outcome.error,
        }, indent=2))

    elif cmd == "sweep":
        from . import convex_client as cvx
        jid = cvx.mutation("runQueue:enqueue", {"trigger": "manual", "requestedBy": "cli"})
        print(f"enqueued sweep: {jid}")

    elif cmd == "track":
        if len(args) < 2:
            print('usage: stalker track "<name>" ["focus"]'); sys.exit(1)
        _track(args[1], args[2] if len(args) > 2 else None)

    elif cmd == "latest":
        if len(args) < 2:
            print('usage: stalker latest "<name>"'); sys.exit(1)
        _latest(args[1])

    elif cmd == "list":
        _list()

    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
