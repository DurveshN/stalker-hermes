"""Orchestrator daemon. Polls the Convex runQueue (the VM has no inbound
ports), claims jobs atomically, and runs the crew. Every trigger source —
Hermes cron, Telegram, dashboard, Cloudflare — just enqueues a row.
"""
from __future__ import annotations

import time
from . import convex_client as cvx
from .config import settings
from .db import init_db
from .pipeline import run_crew


def _handle(job: dict) -> None:
    job_id = job.get("_id")
    claimed = cvx.mutation("runQueue:claim", {"id": job_id, "worker": settings.worker_id})
    if not claimed:
        return  # another worker got it

    trigger = job.get("trigger", "cron")
    focus = job.get("focus")
    competitor_id = job.get("competitorId")
    try:
        if competitor_id:
            targets = [competitor_id]
        else:  # no competitor → sweep all active
            comps = cvx.query("competitors:list", {"activeOnly": True}) or []
            targets = [c["_id"] for c in comps]

        last_run = None
        for cid in targets:
            print(f"[run] competitor={cid} trigger={trigger}")
            outcome = run_crew(competitor_key=cid, trigger=trigger, focus=focus)
            last_run = outcome.run_convex_id
            print(f"[done] new={outcome.new_findings} actions={outcome.actions_filed} "
                  f"escalations={outcome.escalations} status={outcome.status}")
        cvx.mutation("runQueue:complete", {"id": job_id, "runId": last_run})
    except Exception as e:  # noqa: BLE001
        print(f"[job failed] {e}")
        cvx.mutation("runQueue:complete", {"id": job_id, "failed": True})


def _start_slack_thread() -> None:
    """Start the Slack Socket-Mode command handler in a background thread so the
    same daemon serves both the runQueue and /stalker commands."""
    if not settings.slack_socket_enabled:
        print("[slack] socket mode not configured — commands disabled")
        return
    import threading
    from .slack_app import serve_socket
    t = threading.Thread(target=serve_socket, daemon=True, name="slack-socket")
    t.start()
    print("[slack] socket-mode command handler started")


def serve() -> None:
    if not settings.convex_enabled:
        raise RuntimeError("CONVEX_URL required to run the queue subscriber")
    init_db()
    _start_slack_thread()
    print(f"Stalker Hermes orchestrator up. worker={settings.worker_id}")
    print(f"Convex={settings.convex_url}  poll={settings.runqueue_poll_secs}s")
    while True:
        try:
            pending = cvx.query("runQueue:pending", {}) or []
            for job in pending:
                _handle(job)
        except Exception as e:  # noqa: BLE001
            print(f"[poll error] {e}")
        time.sleep(settings.runqueue_poll_secs)


if __name__ == "__main__":
    serve()
