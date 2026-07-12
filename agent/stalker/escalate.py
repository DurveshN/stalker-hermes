"""Telegram escalation delivery. Sends text alerts and voice-note briefs.
Best-effort: never raises, prints on error, no-ops when Telegram is disabled.
"""
from __future__ import annotations

import httpx

from .config import settings

_TIMEOUT = 30


def _base() -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


def send_text(text: str) -> bool:
    """Send a Markdown text message to the configured chat. Returns success."""
    if not settings.telegram_enabled:
        return False
    try:
        resp = httpx.post(
            f"{_base()}/sendMessage",
            data={
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "Markdown",
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return bool(resp.json().get("ok"))
    except Exception as e:  # noqa: BLE001
        print(f"[telegram] send_text failed: {e}")
        return False


def send_voice_note(audio: bytes, caption: str) -> bool:
    """Send an mp3 intel brief as a Telegram audio message. Returns success."""
    if not settings.telegram_enabled:
        return False
    try:
        resp = httpx.post(
            f"{_base()}/sendAudio",
            data={
                "chat_id": settings.telegram_chat_id,
                "caption": caption,
            },
            files={
                "audio": ("intel-brief.mp3", audio, "audio/mpeg"),
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return bool(resp.json().get("ok"))
    except Exception as e:  # noqa: BLE001
        print(f"[telegram] send_voice_note failed: {e}")
        return False
