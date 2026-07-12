"""stalker CLI.

  stalker serve                     run the queue-subscriber daemon
  stalker once "<name>" ["focus"]   one-shot tracking run (local/eval)
  stalker sweep                     enqueue a sweep of all active competitors
  stalker initdb                    create tables directly (dev bootstrap)
"""
from __future__ import annotations

import sys
import json
from .db import init_db


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

    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
