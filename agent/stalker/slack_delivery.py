"""Outbound Slack posting (briefs + voice) via WebClient. Works without Socket
Mode — the pipeline calls this on escalation. No-op safe when Slack is off."""
from __future__ import annotations

from .config import settings
from . import slack_ui

_client = None


def _web():
    global _client
    if _client is None and settings.slack_enabled:
        from slack_sdk import WebClient
        _client = WebClient(token=settings.slack_bot_token)
    return _client


def post_brief(competitor: str, findings: list, brief: str,
               action_links: list[dict], channel: str | None = None) -> str | None:
    """Post an escalation brief. Returns the message ts, or None."""
    c = _web()
    if c is None:
        return None
    ch = channel or settings.slack_channel_id
    if not ch:
        return None
    try:
        blocks = slack_ui.brief_blocks(competitor, findings, brief, action_links)
        resp = c.chat_postMessage(channel=ch, blocks=blocks,
                                  text=f"Intel brief — {competitor}")
        return resp.get("ts")
    except Exception as e:  # never break a run on delivery
        print(f"[slack] post_brief failed: {e}")
        return None


def upload_voice(audio: bytes, competitor: str, thread_ts: str | None = None,
                 channel: str | None = None) -> bool:
    """Upload the ElevenLabs voice brief as an audio file (voice power-up)."""
    c = _web()
    if c is None or not audio:
        return False
    ch = channel or settings.slack_channel_id
    if not ch:
        return False
    try:
        c.files_upload_v2(
            channel=ch, thread_ts=thread_ts, file=audio,
            filename=f"{competitor.replace(' ', '_')}-brief.mp3",
            title=f"Voice brief — {competitor}",
            initial_comment="🔊 Voice brief",
        )
        return True
    except Exception as e:
        print(f"[slack] upload_voice failed: {e}")
        return False


def post_text(text: str, channel: str | None = None) -> str | None:
    c = _web()
    if c is None:
        return None
    ch = channel or settings.slack_channel_id
    if not ch:
        return None
    try:
        return c.chat_postMessage(channel=ch, text=text[:3000]).get("ts")
    except Exception as e:
        print(f"[slack] post_text failed: {e}")
        return None
