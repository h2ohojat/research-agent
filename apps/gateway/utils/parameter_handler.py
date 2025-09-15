# backend/apps/gateway/utils/parameter_handler.py
"""
Parameter normalization utilities + ParameterHandler class.

وظایف:
- نرمال‌سازی پارامترها براساس Provider + Override سطح Model
- مپ‌کردن نام پارامترها و تزریق defaults
- کانورت امن تایپ‌های رایج (bool/number)
- ارائه‌ی کلاس ParameterHandler مطابق انتظار providers/base.py
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, List, Tuple

from ..config.provider_configs import (
    get_provider_config,
    resolve_config,
)

logger = logging.getLogger(__name__)

# کلیدهای رایج برای کانورت تایپی
_NUMERIC_KEYS_INT = {"max_tokens"}
_NUMERIC_KEYS_FLOAT = {"temperature", "top_p", "presence_penalty", "frequency_penalty"}
_BOOLEAN_KEYS = {"stream"}


def _to_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        v = val.strip().lower()
        return v in {"1", "true", "yes", "on"}
    return False


def _to_int(val: Any) -> int:
    try:
        return int(float(val))
    except Exception:
        return 0


def _to_float(val: Any) -> float:
    try:
        return float(val)
    except Exception:
        return 0.0


def _coerce_value(key: str, value: Any) -> Any:
    if key in _BOOLEAN_KEYS:
        return _to_bool(value)
    if key in _NUMERIC_KEYS_INT:
        return _to_int(value)
    if key in _NUMERIC_KEYS_FLOAT:
        return _to_float(value)
    return value


def normalize_params(provider: str, model_id: str, raw_params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    نسخه‌ی تابعی (سازگار به عقب) — خروجی نهایی پارامترهای تمیز‌شده برای Provider/Model.
    """
    cfg = resolve_config(provider, model_id) or {}
    supported = set(cfg.get("supported_parameters", []) or [])
    unsupported = set(cfg.get("unsupported_parameters", []) or {})
    mapping = cfg.get("parameter_mapping", {}) or {}
    defaults = cfg.get("default_parameters", {}) or {}

    out: Dict[str, Any] = dict(defaults)
    if not raw_params:
        return out

    for key, value in raw_params.items():
        if key in unsupported:
            logger.debug("Dropping unsupported parameter for %s/%s: %s", provider, model_id, key)
            continue
        if key not in supported:
            logger.debug("Ignoring non-supported parameter for %s/%s: %s", provider, model_id, key)
            continue

        coerced = _coerce_value(key, value)
        mapped_key = mapping.get(key, key)
        out[mapped_key] = coerced

    return out


def merge_into_payload(base_payload: Dict[str, Any], normalized_params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not normalized_params:
        return base_payload
    merged = dict(base_payload or {})
    for k, v in normalized_params.items():
        merged[k] = v
    return merged


class ParameterHandler:
    """
    کلاس مورد انتظار در providers/base.py
    - استفاده‌ی داخلی از resolve_config برای مدل انتخابی
    - public API:
        * prepare_request_data(messages, model, **params) -> dict
        * validate_request_data(request_data) -> (bool, str)
        * is_parameter_supported(param_name) -> bool   [سطح Provider]
        * map_parameter(param_name, value) -> (mapped_name, coerced_value) [سطح Provider]
        * supports_feature(name) -> bool
    - property:
        * config: dict (کانفیگ پایه‌ی Provider شامل default_parameters)
    """

    def __init__(self, provider_name: str):
        self.provider = (provider_name or "base").lower()
        # کانفیگ پایه‌ی Provider (نه per-model) برای سازگاری با استفاده‌های موجود
        self.config: Dict[str, Any] = get_provider_config(self.provider) or {}
        logger.info("ParameterHandler initialized for provider=%s", self.provider)

    # ---- متدهای اصلی که base.py انتظار دارد ----

    def prepare_request_data(self, messages: List[Dict[str, str]], model: str, **params) -> Dict[str, Any]:
        """
        خروجی: payload آماده برای Provider با درنظرگرفتن:
          - defaults
          - allow/deny per model
          - mapping نام پارامتر
          - کانورت امن تایپ‌ها
        """
        if not isinstance(messages, list) or not messages:
            raise ValueError("messages must be a non-empty list")
        if not model or not isinstance(model, str):
            raise ValueError("model must be a non-empty string")

        cfg = resolve_config(self.provider, model) or {}
        supported = set(cfg.get("supported_parameters", []) or [])
        unsupported = set(cfg.get("unsupported_parameters", []) or [])
        mapping = cfg.get("parameter_mapping", {}) or {}
        defaults = cfg.get("default_parameters", {}) or {}

        # شروع payload با اجزای ثابت
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
        }
        # تزریق دیفالت‌ها
        payload.update(defaults)

        # نرمال‌سازی پارامترها
        for key, value in (params or {}).items():
            if key in unsupported:
                logger.debug("Dropping unsupported parameter: %s", key)
                continue
            if key not in supported:
                logger.debug("Ignoring non-supported parameter: %s", key)
                continue
            coerced = _coerce_value(key, value)
            mapped_key = mapping.get(key, key)
            payload[mapped_key] = coerced

        return payload

    def validate_request_data(self, request_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        اعتبارسنجی سبک (بدون سخت‌گیری بیش‌ازحد):
          - model string
          - messages list[dict] با role/content
          - بررسی پایه روی stream,max_tokens,... (اگر حاضر باشند)
        """
        if not isinstance(request_data, dict):
            return False, "request_data must be a dict"
        model = request_data.get("model")
        messages = request_data.get("messages")

        if not model or not isinstance(model, str):
            return False, "model is required"
        if not isinstance(messages, list) or not messages:
            return False, "messages must be a non-empty list"

        # نقش/محتوا حداقل چک سبک
        for i, msg in enumerate(messages):
            if not isinstance(msg, dict):
                return False, f"messages[{i}] must be a dict"
            if "role" not in msg or "content" not in msg:
                return False, f"messages[{i}] must contain role and content"

        # چک نرم تایپ‌های رایج اگر حاضرند
        if "stream" in request_data and not isinstance(request_data["stream"], bool):
            return False, "stream must be boolean"
        for k in _NUMERIC_KEYS_INT:
            if k in request_data and not isinstance(request_data[k], (int, float)):
                return False, f"{k} must be numeric"
        for k in _NUMERIC_KEYS_FLOAT:
            if k in request_data and not isinstance(request_data[k], (int, float)):
                return False, f"{k} must be numeric"

        return True, "ok"

    def is_parameter_supported(self, parameter: str) -> bool:
        """
        نسخه‌ی سطح Provider (بدون model). برای مصرف فعلی در base.py کافی است.
        """
        base_cfg = self.config or {}
        supported = set(base_cfg.get("supported_parameters", []) or [])
        return parameter in supported

    def map_parameter(self, parameter: str, value: Any) -> Tuple[str, Any]:
        """
        نسخه‌ی سطح Provider. مپ نام + کانورت نرم مقدار.
        """
        base_cfg = self.config or {}
        mapping = base_cfg.get("parameter_mapping", {}) or {}
        mapped = mapping.get(parameter, parameter)
        return mapped, _coerce_value(parameter, value)

    def supports_feature(self, feature_name: str) -> bool:
        """
        پشتیبانی از قابلیت‌ها در حالت ساده:
          - اگر 'stream' در supported_parameters بود => streaming پشتیبانی می‌شود.
          - usage_tracking به‌صورت محافظه‌کارانه False (می‌توان از کانفیگ توسعه داد).
        """
        base_cfg = self.config or {}
        supported = set(base_cfg.get("supported_parameters", []) or [])

        if feature_name == "streaming":
            return "stream" in supported
        if feature_name == "usage_tracking":
            return False
        return False


__all__ = [
    "ParameterHandler",
    "normalize_params",
    "merge_into_payload",
]
