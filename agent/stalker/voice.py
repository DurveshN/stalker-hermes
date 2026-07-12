"""ElevenLabs voice briefs + Convex upload.

`synthesize` turns text into mp3 bytes. `upload_to_convex` stores those bytes in
Convex file storage and returns a public URL. Best-effort: never raises.
"""
from __future__ import annotations

import httpx

from . import convex_client
from .config import settings

_TIMEOUT = 30
_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


def synthesize(text: str) -> bytes | None:
    """Render text to mp3 bytes via ElevenLabs. None if disabled or on error."""
    if not settings.elevenlabs_enabled:
        return None
    try:
        resp = httpx.post(
            _TTS_URL.format(voice_id=settings.elevenlabs_voice_id),
            params={"output_format": "mp3_44100_128"},
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={
                "text": text[:2500],
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.content
    except Exception as e:  # noqa: BLE001
        print(f"[voice] synthesize failed: {e}")
        return None


def upload_to_convex(audio: bytes) -> str | None:
    """Store mp3 bytes in Convex storage and return a public URL. None on failure
    or when Convex is disabled."""
    if not settings.convex_enabled:
        return None
    try:
        upload_url = convex_client.mutation("files:generateUploadUrl", {})
        if not upload_url:
            return None

        resp = httpx.post(
            upload_url,
            content=audio,
            headers={"Content-Type": "audio/mpeg"},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        storage_id = resp.json().get("storageId")
        if not storage_id:
            return None

        url = convex_client.query("files:getUrl", {"storageId": storage_id})
        return url or None
    except Exception as e:  # noqa: BLE001
        print(f"[voice] upload_to_convex failed: {e}")
        return None
