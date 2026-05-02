"""LiteLLM proxy CustomLogger: guardrails, tier routing, system shield, JSON logging."""

from __future__ import annotations

import contextvars
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union

import httpx
from fastapi import HTTPException
from litellm.integrations.custom_logger import CustomLogger

try:
    from litellm.proxy._types import UserAPIKeyAuth
except ImportError:  # pragma: no cover
    from litellm.proxy.proxy_server import UserAPIKeyAuth  # type: ignore

from . import classifier, guardrails, redis_cache

_log_ctx: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    "gateway_log_ctx", default=None
)


def _flatten_text_from_content(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "text" and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "\n".join(parts)
    return ""


def _collect_user_text(messages: Any) -> str:
    if not isinstance(messages, list):
        return ""
    chunks: List[str] = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        if m.get("role") != "user":
            continue
        chunks.append(_flatten_text_from_content(m.get("content")))
    return "\n".join(chunks)


def _last_user_message(messages: Any) -> str:
    if not isinstance(messages, list):
        return ""
    for m in reversed(messages):
        if isinstance(m, dict) and m.get("role") == "user":
            return _flatten_text_from_content(m.get("content")).strip()
    return ""


def _prepend_shield(messages: List[Dict[str, Any]]) -> None:
    if not messages:
        messages.insert(0, {"role": "system", "content": _SHIELD})
        return
    first = messages[0]
    if isinstance(first, dict) and first.get("role") == "system":
        c = first.get("content")
        if isinstance(c, str):
            first["content"] = guardrails.SHIELD_TEXT + "\n\n" + c
        elif isinstance(c, list):
            first["content"] = [{"type": "text", "text": guardrails.SHIELD_TEXT}] + list(c)
        else:
            first["content"] = guardrails.SHIELD_TEXT
    else:
        messages.insert(0, {"role": "system", "content": guardrails.SHIELD_TEXT})


def _read_tier_metadata(data: dict) -> Optional[Literal["basic", "premium"]]:
    md = data.get("metadata")
    if isinstance(md, dict):
        t = md.get("tier")
        if isinstance(t, str):
            tl = t.strip().lower()
            if tl in ("basic", "premium"):
                return tl  # type: ignore[return-value]
    lm = data.get("litellm_metadata")
    if isinstance(lm, dict):
        rm = lm.get("requester_metadata")
        if isinstance(rm, dict):
            t = rm.get("tier")
            if isinstance(t, str):
                tl = t.strip().lower()
                if tl in ("basic", "premium"):
                    return tl  # type: ignore[return-value]
    return None


def _key_alias(user_api_key_dict: UserAPIKeyAuth) -> str:
    meta = getattr(user_api_key_dict, "metadata", None) or {}
    if isinstance(meta, dict):
        for k in ("key_alias", "alias", "key_name"):
            v = meta.get(k)
            if isinstance(v, str) and v:
                return v
    for attr in ("key_alias", "key_name", "token_alias"):
        v = getattr(user_api_key_dict, attr, None)
        if isinstance(v, str) and v:
            return v
    return ""


class GatewayPlugin(CustomLogger):
    def __init__(self) -> None:
        super().__init__()
        self._http: Optional[httpx.AsyncClient] = None

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=60.0)
        return self._http

    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: Any,
        data: dict,
        call_type: str,
    ) -> Optional[Union[dict, str, Exception]]:
        ctx: Dict[str, Any] = {
            "key_alias": _key_alias(user_api_key_dict),
            "classifier_cache": "skipped",
            "tier": None,
            "target_model": None,
            "client_model": data.get("model"),
        }
        _log_ctx.set(ctx.copy())

        if call_type == "text_completion":
            prompt = data.get("prompt") or ""
            if isinstance(prompt, str) and guardrails.guardrail_violation(prompt):
                raise HTTPException(status_code=400, detail="")
            if isinstance(prompt, str) and prompt:
                data["prompt"] = guardrails.SHIELD_TEXT + "\n\n" + prompt
            forced = _read_tier_metadata(data)
            blob = prompt if isinstance(prompt, str) else ""
            tier_label, ccache = await self._resolve_tier(forced, blob)
            ctx["classifier_cache"] = ccache
            ctx["tier"] = tier_label
            ctx["target_model"] = (
                "gateway-premium" if tier_label == "premium" else "gateway-basic"
            )
            data["model"] = ctx["target_model"]
            self._stamp_metadata(data, tier_label, ccache, ctx["target_model"])
            _log_ctx.set(ctx.copy())
            return data

        if call_type != "completion":
            return data

        messages = data.get("messages")
        if not isinstance(messages, list):
            return data

        user_blob = _collect_user_text(messages)
        if guardrails.guardrail_violation(user_blob):
            raise HTTPException(status_code=400, detail="")

        msgs = [dict(m) for m in messages if isinstance(m, dict)]
        _prepend_shield(msgs)
        data["messages"] = msgs

        forced = _read_tier_metadata(data)
        last_user = _last_user_message(msgs)
        tier_label, ccache = await self._resolve_tier(forced, last_user)
        ctx["classifier_cache"] = ccache
        ctx["tier"] = tier_label
        if tier_label == "premium":
            data["model"] = "gateway-premium"
            ctx["target_model"] = "gateway-premium"
        else:
            data["model"] = "gateway-basic"
            ctx["target_model"] = "gateway-basic"

        self._stamp_metadata(data, tier_label, ccache, ctx["target_model"])
        _log_ctx.set(ctx.copy())
        return data

    def _stamp_metadata(self, data: dict, tier_label: str, ccache: str, target: str) -> None:
        if isinstance(data.get("litellm_metadata"), dict):
            data["litellm_metadata"]["_gateway_tier"] = tier_label
            data["litellm_metadata"]["_gateway_classifier_cache"] = ccache
            data["litellm_metadata"]["_gateway_target_model"] = target
        else:
            data["litellm_metadata"] = {
                "_gateway_tier": tier_label,
                "_gateway_classifier_cache": ccache,
                "_gateway_target_model": target,
            }

    async def _resolve_tier(
        self,
        forced: Optional[Literal["basic", "premium"]],
        last_user: str,
    ) -> tuple[Literal["basic", "premium"], str]:
        if forced:
            return forced, "skipped"
        if not last_user:
            return "basic", "skipped"
        cached = await redis_cache.get_cached_tier(last_user)
        if cached == "PREMIUM":
            return "premium", "hit"
        if cached == "BASIC":
            return "basic", "hit"
        ctier = await classifier.classify_last_user_message(last_user, await self._client())
        tier_label: Literal["basic", "premium"] = (
            "premium" if ctier == "PREMIUM" else "basic"
        )
        try:
            await redis_cache.set_cached_tier(
                last_user, "PREMIUM" if tier_label == "premium" else "BASIC"
            )
        except Exception:
            pass
        return tier_label, "miss"

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        await self._emit_log(kwargs, response_obj, start_time, end_time, error=None)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        await self._emit_log(kwargs, None, start_time, end_time, error=response_obj)

    async def _emit_log(self, kwargs, response_obj, start_time, end_time, error):
        ctx = dict(_log_ctx.get() or {})
        ts = datetime.now(timezone.utc).isoformat()
        usage = None
        model_used = kwargs.get("model") or kwargs.get("model_id")
        if error is None and response_obj is not None:
            usage = getattr(response_obj, "usage", None)
            mu = getattr(response_obj, "model", None)
            if mu:
                model_used = mu
        usage_dict = (
            {
                "prompt_tokens": getattr(usage, "prompt_tokens", None),
                "completion_tokens": getattr(usage, "completion_tokens", None),
                "total_tokens": getattr(usage, "total_tokens", None),
            }
            if usage is not None
            else None
        )
        cost = None
        if error is None and response_obj is not None:
            try:
                from litellm.cost_calculator import completion_cost

                cost = float(completion_cost(completion_response=response_obj))
            except Exception:
                try:
                    from litellm import completion_cost as cc

                    cost = float(cc(completion_response=response_obj))
                except Exception:
                    cost = None

        row = {
            "timestamp": ts,
            "key_alias": ctx.get("key_alias") or "",
            "tier": ctx.get("tier"),
            "classifier_cache": ctx.get("classifier_cache"),
            "model_requested": ctx.get("client_model"),
            "model_used": model_used,
            "usage": usage_dict,
            "cost": cost,
            "error": str(error) if error is not None else None,
        }
        print(json.dumps(row, default=str), flush=True)


gateway_handler = GatewayPlugin()
