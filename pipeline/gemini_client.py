"""Centralized Google GenAI SDK (v3.2+) client helpers, retries, and media upload.

Follows AGENTS.md strictly:
- Interactions API (`client.interactions.create`) on `v1`
- Decisions API (`client.decisions.create`) on `v1beta` with `gemini-decision-1`
- Files API (`client.files.upload`) for video segments
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import time
from typing import Any, Callable, Optional, TypeVar

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

TModel = TypeVar("TModel", bound=BaseModel)


def _require_genai():
    try:
        from google import genai

        return genai
    except ImportError as exc:
        raise RuntimeError(
            "Missing 'google-genai' SDK (>=3.2.0). Run: pip install -r requirements.txt"
        ) from exc


def get_v1_client(api_key: Optional[str] = None):
    """Return stable v1 client for Interactions API and Files API."""
    genai = _require_genai()
    key = api_key or os.getenv("GEMINI_API_KEY")
    return genai.Client(api_key=key) if key else genai.Client()


def get_v1beta_client(api_key: Optional[str] = None):
    """Return v1beta client required for Decisions API (`gemini-decision-1`)."""
    genai = _require_genai()
    key = api_key or os.getenv("GEMINI_API_KEY")
    if key:
        return genai.Client(api_key=key, http_options={"api_version": "v1beta"})
    return genai.Client(http_options={"api_version": "v1beta"})


def call_with_retries(
    fn: Callable[[], Any],
    *,
    max_attempts: int = 3,
    initial_delay_sec: float = 2.0,
) -> Any:
    """Retry transient rate-limit / 5xx network errors with exponential backoff."""
    delay = initial_delay_sec
    last_exc: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            msg = str(exc).lower()
            retryable = any(
                token in msg
                for token in (
                    "429",
                    "rate",
                    "quota",
                    "500",
                    "502",
                    "503",
                    "504",
                    "timeout",
                    "temporarily",
                    "connection",
                )
            )
            if not retryable or attempt == max_attempts:
                raise
            time.sleep(delay)
            delay *= 2.0
    assert last_exc is not None
    raise last_exc


def encode_file_base64(path: str | Path) -> str:
    return base64.b64encode(Path(path).read_bytes()).decode("utf-8")


def build_video_input_part(
    client: Any,
    video_path: str | Path,
    *,
    agentic: bool = False,
    inline_max_mb: float = 12.0,
) -> dict[str, Any]:
    """Build a `video` content dict for `client.interactions.create`.

    - Short small clips (< inline_max_mb) in static mode pass inline base64 to
      skip File API polling latency.
    - Larger segments or `agentic=True` upload via `client.files.upload` and poll
      until ACTIVE.
    """
    vpath = Path(video_path).resolve()
    size_mb = vpath.stat().st_size / (1024.0 * 1024.0)

    if not agentic and size_mb <= inline_max_mb:
        return {
            "type": "video",
            "data": encode_file_base64(vpath),
            "mime_type": "video/mp4",
        }

    uploaded = call_with_retries(lambda: client.files.upload(file=str(vpath)))
    poll_wait = 1.5
    while not uploaded.state or getattr(uploaded.state, "name", str(uploaded.state)) != "ACTIVE":
        state_name = getattr(uploaded.state, "name", str(uploaded.state or ""))
        if state_name == "FAILED":
            raise RuntimeError(f"Gemini Files API processing failed for {vpath}")
        time.sleep(poll_wait)
        uploaded = call_with_retries(lambda: client.files.get(name=uploaded.name))

    part: dict[str, Any] = {
        "type": "video",
        "uri": uploaded.uri,
        "mime_type": uploaded.mime_type or "video/mp4",
    }
    if agentic:
        part["processing"] = "agentic"
    return part


def extract_json_text(raw_text: str) -> str:
    """Strip accidental markdown code fences if present around JSON output."""
    text = (raw_text or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def create_structured_interaction(
    client: Any,
    *,
    model: str,
    input_payload: str | list[dict[str, Any]],
    schema_model: type[TModel],
    system_instruction: Optional[str] = None,
    background: bool = False,
    store: bool = False,
) -> TModel:
    """Invoke `client.interactions.create` with Pydantic JSON schema validation."""
    kwargs: dict[str, Any] = {
        "model": model,
        "input": input_payload,
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": schema_model.model_json_schema(),
        },
        "store": True if background else store,
    }
    if system_instruction:
        kwargs["system_instruction"] = system_instruction
    if background:
        kwargs["background"] = True

    interaction = call_with_retries(lambda: client.interactions.create(**kwargs))

    if background:
        while interaction.status in ("queued", "in_progress"):
            time.sleep(4.0)
            interaction = call_with_retries(
                lambda: client.interactions.get(interaction.id)
            )
        if interaction.status != "completed":
            raise RuntimeError(
                f"Background interaction {interaction.id} ended with status={interaction.status}"
            )

    raw_json = extract_json_text(interaction.output_text or "")
    if not raw_json:
        raise RuntimeError(f"Model {model} returned empty output_text.")

    try:
        return schema_model.model_validate_json(raw_json)
    except Exception:
        # Fallback: parse dict in case minor float/int coercion helps
        data = json.loads(raw_json)
        return schema_model.model_validate(data)
