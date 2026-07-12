"""Central config loaded from the repo-root .env. Import `settings` everywhere."""
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Repo root is two levels up from this file (agent/stalker/config.py).
REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def _req(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def _opt(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


class Settings:
    version = "v1"  # bump on prompt/agent changes → eval trend tracking

    # LLM (OpenAI — real API key, separate from the VM's Codex login)
    openai_api_key = _opt("OPENAI_API_KEY")
    manager_model = _opt("MANAGER_MODEL", "gpt-5.5")
    specialist_model = _opt("SPECIALIST_MODEL", "gpt-5.5")

    linkup_api_key = _opt("LINKUP_API_KEY")
    convex_url = _opt("CONVEX_URL")

    # Postgres (SQLAlchemy). If unset, DB writes are skipped (dev fallback).
    pg_host = _opt("PGHOST")
    pg_port = _opt("PGPORT", "5432")
    pg_db = _opt("PGDATABASE", "stalker")
    pg_user = _opt("PGUSER")
    pg_password = _opt("PGPASSWORD")
    pg_sslmode = _opt("PGSSLMODE", "require")

    # GitHub action queue target
    github_repo = _opt("GITHUB_REPO", "DurveshN/stalker-hermes")
    github_token = _opt("GITHUB_TOKEN")  # falls back to gh CLI auth if empty

    # Telegram escalation delivery
    telegram_bot_token = _opt("TELEGRAM_BOT_TOKEN")
    telegram_chat_id = _opt("TELEGRAM_CHAT_ID")

    # ElevenLabs voice briefs
    elevenlabs_api_key = _opt("ELEVENLABS_API_KEY")
    elevenlabs_voice_id = _opt("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    # Runtime knobs
    runqueue_poll_secs = float(_opt("RUNQUEUE_POLL_SECS", "4"))
    run_cost_cap_usd = float(_opt("RUN_COST_CAP_USD", "0.50"))
    max_parallel_specialists = int(_opt("MAX_PARALLEL_SPECIALISTS", "5"))
    worker_id = f"orch-{os.getpid()}"

    @property
    def pg_enabled(self) -> bool:
        return bool(self.pg_host)

    @property
    def pg_url(self) -> str:
        # URL-encode credentials so special chars (#, @, /, etc.) don't break the DSN.
        from urllib.parse import quote_plus
        user = quote_plus(self.pg_user)
        pw = quote_plus(self.pg_password)
        return (
            f"postgresql+psycopg://{user}:{pw}"
            f"@{self.pg_host}:{self.pg_port}/{self.pg_db}?sslmode={self.pg_sslmode}"
        )

    @property
    def convex_enabled(self) -> bool:
        return bool(self.convex_url)

    @property
    def telegram_enabled(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)

    @property
    def elevenlabs_enabled(self) -> bool:
        return bool(self.elevenlabs_api_key)


settings = Settings()

# ---------------------------------------------------------------------------
# LLM pricing (USD per 1M tokens). [Unverified] GPT-5.x public rates were not
# confirmed at build time — these are editable placeholders, override via env
# (PRICE_IN_<model> / PRICE_OUT_<model>). Cost *accounting* is structurally
# correct; only the rate constants need real values. AI pricing may vary.
# ---------------------------------------------------------------------------
_DEFAULT_RATES: dict[str, tuple[float, float]] = {
    "gpt-5.5": (2.50, 10.00),
    "gpt-5.1": (2.50, 10.00),
    "gpt-5-mini": (0.40, 1.60),
}


def cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    rin = os.environ.get(f"PRICE_IN_{model}")
    rout = os.environ.get(f"PRICE_OUT_{model}")
    base = _DEFAULT_RATES.get(model, (2.50, 10.00))
    price_in = float(rin) if rin else base[0]
    price_out = float(rout) if rout else base[1]
    return (tokens_in / 1_000_000) * price_in + (tokens_out / 1_000_000) * price_out
