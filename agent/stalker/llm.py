"""OpenAI client + a single call helper that returns text/parsed + token usage,
so every LLM call can be traced with exact cost."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Type, TypeVar
from openai import OpenAI
from pydantic import BaseModel

from .config import settings

_client: OpenAI | None = None
T = TypeVar("T", bound=BaseModel)


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


@dataclass
class LLMResult:
    text: str
    tokens_in: int
    tokens_out: int
    model: str
    tool_calls: list[Any] | None = None
    raw: Any = None


def _usage(resp: Any) -> tuple[int, int]:
    u = getattr(resp, "usage", None)
    if not u:
        return 0, 0
    return getattr(u, "prompt_tokens", 0) or 0, getattr(u, "completion_tokens", 0) or 0


def chat(
    model: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    tool_choice: str | None = None,
    temperature: float | None = None,
) -> LLMResult:
    """One chat-completions turn. Returns text + any tool calls + usage."""
    kwargs: dict[str, Any] = {"model": model, "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = tool_choice or "auto"
    if temperature is not None:
        kwargs["temperature"] = temperature
    resp = client().chat.completions.create(**kwargs)
    msg = resp.choices[0].message
    tin, tout = _usage(resp)
    return LLMResult(
        text=msg.content or "",
        tokens_in=tin,
        tokens_out=tout,
        model=model,
        tool_calls=list(msg.tool_calls) if msg.tool_calls else None,
        raw=msg,
    )


def parse(model: str, messages: list[dict], schema: Type[T]) -> tuple[T, int, int]:
    """Structured output via the parse API. Returns (obj, tokens_in, tokens_out)."""
    resp = client().beta.chat.completions.parse(
        model=model, messages=messages, response_format=schema
    )
    tin, tout = _usage(resp)
    return resp.choices[0].message.parsed, tin, tout  # type: ignore[return-value]
