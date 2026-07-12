"""GitHub action queue. Files issues and opens PRs via the GitHub REST API
using GITHUB_TOKEN (httpx) — no `gh` binary or local clone needed, so it works
identically on a laptop or the VM. Every call is wrapped so a partial failure
never crashes a run.
"""
from __future__ import annotations

import base64
import re
import time

import httpx

from ..config import settings

_API = "https://api.github.com"
_TIMEOUT = 30


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-")[:60] or "response"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _fail(error: str) -> dict:
    return {"number": None, "url": None, "ok": False, "error": error}


def create_issue(title: str, body: str, labels: list[str] | None = None) -> dict:
    """Create an issue in settings.github_repo. Returns {number,url,ok,error}."""
    if not settings.github_token:
        return _fail("GITHUB_TOKEN not set")
    payload: dict = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    try:
        r = httpx.post(f"{_API}/repos/{settings.github_repo}/issues",
                       headers=_headers(), json=payload, timeout=_TIMEOUT)
        if r.status_code >= 300:
            return _fail(f"{r.status_code}: {r.text[:200]}")
        d = r.json()
        return {"number": d.get("number"), "url": d.get("html_url"), "ok": True, "error": None}
    except Exception as e:  # noqa: BLE001
        return _fail(str(e))


def open_pr(title: str, body: str, file_path: str, file_content: str,
            branch: str | None = None) -> dict:
    """Open a PR that adds/updates one file via the REST API (no clone)."""
    if not settings.github_token:
        return _fail("GITHUB_TOKEN not set")
    repo = settings.github_repo
    branch = branch or f"stalker/{slugify(title)}-{int(time.time()) % 100000}"
    try:
        with httpx.Client(headers=_headers(), timeout=_TIMEOUT) as c:
            # (a) default branch + head sha
            repo_info = c.get(f"{_API}/repos/{repo}")
            if repo_info.status_code >= 300:
                return _fail(f"repo: {repo_info.status_code}")
            default = repo_info.json().get("default_branch", "main")
            ref = c.get(f"{_API}/repos/{repo}/git/ref/heads/{default}")
            if ref.status_code >= 300:
                return _fail(f"ref: {ref.status_code}")
            sha = ref.json()["object"]["sha"]

            # (b) new branch ref
            br = c.post(f"{_API}/repos/{repo}/git/refs",
                        json={"ref": f"refs/heads/{branch}", "sha": sha})
            if br.status_code >= 300:
                return _fail(f"branch: {br.status_code}: {br.text[:150]}")

            # (c) create the file on that branch
            content_b64 = base64.b64encode(file_content.encode("utf-8")).decode("ascii")
            put = c.put(f"{_API}/repos/{repo}/contents/{file_path}",
                        json={"message": title, "content": content_b64, "branch": branch})
            if put.status_code >= 300:
                return _fail(f"file: {put.status_code}: {put.text[:150]}")

            # (d) open the PR
            pr = c.post(f"{_API}/repos/{repo}/pulls",
                        json={"title": title, "body": body, "head": branch, "base": default})
            if pr.status_code >= 300:
                return _fail(f"pr: {pr.status_code}: {pr.text[:150]}")
            d = pr.json()
            return {"number": d.get("number"), "url": d.get("html_url"), "ok": True, "error": None}
    except Exception as e:  # noqa: BLE001
        return _fail(str(e))
