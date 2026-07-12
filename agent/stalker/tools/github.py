"""GitHub action queue. Files issues and opens PRs via the `gh` CLI.

`create_issue` shells out to `gh issue create`. `open_pr` uses the GitHub REST
API through `gh api` so we never need a local clone of the target repo. Every
step is wrapped so a demo never crashes on a partial failure.
"""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import time

from ..config import settings

_TIMEOUT = 60


def slugify(text: str) -> str:
    """Lowercase, hyphenated, ascii-safe slug suitable for a branch name."""
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-")[:60] or "response"


def _env() -> dict[str, str]:
    """Env for the subprocess. Pass GH_TOKEN when GITHUB_TOKEN is configured."""
    env = os.environ.copy()
    if settings.github_token:
        env["GH_TOKEN"] = settings.github_token
    return env


def _run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=_TIMEOUT,
        env=_env(),
    )


def create_issue(title: str, body: str, labels: list[str] | None = None) -> dict:
    """Create a GitHub issue in settings.github_repo. Returns
    {"number", "url", "ok", "error"}."""
    args = [
        "gh", "issue", "create",
        "--repo", settings.github_repo,
        "--title", title,
        "--body", body,
    ]
    for label in labels or []:
        args += ["--label", label]

    try:
        proc = _run(args)
    except Exception as e:  # noqa: BLE001 - never raise out of a tool
        return {"number": None, "url": None, "ok": False, "error": str(e)}

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "gh issue create failed").strip()
        return {"number": None, "url": None, "ok": False, "error": err}

    url = _first_issue_url(proc.stdout)
    return {
        "number": _issue_number_from_url(url),
        "url": url,
        "ok": bool(url),
        "error": None if url else "could not parse issue url from gh output",
    }


def open_pr(
    title: str,
    body: str,
    file_path: str,
    file_content: str,
    branch: str | None = None,
) -> dict:
    """Open a PR that adds/updates one file via the REST API (no local clone).
    Returns {"number", "url", "ok", "error"}."""
    repo = settings.github_repo
    if not branch:
        branch = f"stalker/{slugify(title)}-{int(time.time()) % 100000}"

    try:
        # (a) default branch + its head sha
        default = _api_scalar(["gh", "api", f"repos/{repo}", "--jq", ".default_branch"])
        if not default:
            return _fail("could not resolve default branch")
        sha = _api_scalar(
            ["gh", "api", f"repos/{repo}/git/ref/heads/{default}", "--jq", ".object.sha"]
        )
        if not sha:
            return _fail("could not resolve default branch sha")

        # (b) create the new branch ref
        proc = _run([
            "gh", "api", "-X", "POST", f"repos/{repo}/git/refs",
            "-f", f"ref=refs/heads/{branch}",
            "-f", f"sha={sha}",
        ])
        if proc.returncode != 0:
            return _fail(_stderr(proc, "create branch ref failed"))

        # (c) create the file on that branch
        content_b64 = base64.b64encode(file_content.encode("utf-8")).decode("ascii")
        proc = _run([
            "gh", "api", "-X", "PUT", f"repos/{repo}/contents/{file_path}",
            "-f", f"message={title}",
            "-f", f"content={content_b64}",
            "-f", f"branch={branch}",
        ])
        if proc.returncode != 0:
            return _fail(_stderr(proc, "create file failed"))

        # (d) open the PR
        proc = _run([
            "gh", "api", "-X", "POST", f"repos/{repo}/pulls",
            "-f", f"title={title}",
            "-f", f"body={body}",
            "-f", f"head={branch}",
            "-f", f"base={default}",
        ])
        if proc.returncode != 0:
            return _fail(_stderr(proc, "open pr failed"))

        data = json.loads(proc.stdout or "{}")
        return {
            "number": data.get("number"),
            "url": data.get("html_url"),
            "ok": bool(data.get("html_url")),
            "error": None,
        }
    except Exception as e:  # noqa: BLE001 - keep the demo alive
        return _fail(str(e))


# --- helpers ---------------------------------------------------------------

def _api_scalar(args: list[str]) -> str | None:
    proc = _run(args)
    if proc.returncode != 0:
        return None
    return (proc.stdout or "").strip() or None


def _first_issue_url(text: str) -> str | None:
    m = re.search(r"https://github\.com/\S+/issues/\d+", text or "")
    return m.group(0) if m else None


def _issue_number_from_url(url: str | None) -> int | None:
    if not url:
        return None
    m = re.search(r"/issues/(\d+)", url)
    return int(m.group(1)) if m else None


def _stderr(proc: subprocess.CompletedProcess, fallback: str) -> str:
    return (proc.stderr or proc.stdout or fallback).strip()


def _fail(error: str) -> dict:
    return {"number": None, "url": None, "ok": False, "error": error}
