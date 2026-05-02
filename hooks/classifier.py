"""Tier classifier via direct DeepSeek OpenAI-compatible API (no proxy loop)."""

from __future__ import annotations

import json
import os
from typing import Literal, Optional

import httpx

Tier = Literal["BASIC", "PREMIUM"]


def parse_tier_response(text: str) -> Tier:
    """Parse model output into BASIC or PREMIUM (defaults BASIC)."""
    u = text.strip().upper()
    if "PREMIUM" in u:
        return "PREMIUM"
    if "BASIC" in u:
        return "BASIC"
    return "BASIC"


async def classify_last_user_message(user_text: str, client: Optional[httpx.AsyncClient] = None) -> Tier:
    """Return BASIC or PREMIUM; never raises — defaults to BASIC."""
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return "BASIC"

    api_base = os.getenv("GATEWAY_DEEPSEEK_API_BASE", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("GATEWAY_CLASSIFIER_MODEL", "deepseek-chat")
    url = f"{api_base}/v1/chat/completions"

    system = (
        "You classify the user's message for routing. "
        "Reply with exactly one word: BASIC or PREMIUM. "
        "PREMIUM = complex reasoning, multi-step math/code, legal/medical nuance, long-form analysis, creative writing at publication quality. "
        "BASIC = chit-chat, simple facts, short Q&A, trivial tasks."
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_text[:8000]},
        ],
        "max_tokens": 8,
        "temperature": 0,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    own_client = client is None
    hc = client or httpx.AsyncClient(timeout=30.0)
    try:
        resp = await hc.post(url, headers=headers, content=json.dumps(payload))
        resp.raise_for_status()
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        msg = (choice.get("message") or {}).get("content") or ""
        return parse_tier_response(msg)
    except Exception:
        return "BASIC"
    finally:
        if own_client:
            await hc.aclose()
