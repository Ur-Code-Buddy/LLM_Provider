"""Classifier result cache (separate from LiteLLM response cache)."""

from __future__ import annotations

import hashlib
import os
from typing import Literal, Optional

import redis.asyncio as redis

OptionalTier = Optional[Literal["BASIC", "PREMIUM"]]

_redis: Optional[redis.Redis] = None


def _normalize_message(text: str) -> str:
    return " ".join(text.strip().lower().split())


def cache_key(message: str) -> str:
    normalized = _normalize_message(message)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"tiercls:v1:{digest}"


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        url = os.getenv("GATEWAY_REDIS_URL", "redis://redis:6379/0")
        _redis = redis.from_url(url, decode_responses=True)
    return _redis


async def get_cached_tier(message: str) -> OptionalTier:
    r = await get_redis()
    val = await r.get(cache_key(message))
    if val == "BASIC" or val == "PREMIUM":
        return val
    return None


async def set_cached_tier(message: str, tier: Literal["BASIC", "PREMIUM"]) -> None:
    r = await get_redis()
    ttl = int(os.getenv("GATEWAY_CLASSIFIER_TTL_SECONDS", "604800"))
    await r.set(cache_key(message), tier, ex=ttl)
