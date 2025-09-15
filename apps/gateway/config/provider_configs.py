"""
Provider-specific configurations and parameter mappings.
- Base provider config
- Optional per-model overrides
"""

from typing import Dict, Any, List

# -----------------------------
# Base registry (provider level)
# -----------------------------
PROVIDER_CONFIGS: Dict[str, Dict[str, Any]] = {
    # AvalAI is OpenAI-compatible; /chat/completions style
    "avalai": {
        # Parameters this provider understands at a base level
        "supported_parameters": [
            "model", "messages",
            "temperature", "top_p",
            "max_tokens", "stop",
            "presence_penalty", "frequency_penalty",
            "stream", "response_format",
            # (افزودن تدریجی در آینده: tools, tool_choice, logprobs, top_k, ... )
        ],
        # Rename map if provider expects different keys (here mostly 1:1)
        "parameter_mapping": {
            "max_tokens": "max_tokens",
            "temperature": "temperature",
            "top_p": "top_p",
            "presence_penalty": "presence_penalty",
            "frequency_penalty": "frequency_penalty",
            "stop": "stop",
            "stream": "stream",
            "response_format": "response_format",
        },
        # Safe defaults (applied unless overridden)
        "default_parameters": {
            "stream": True,
        },
        # Globally unsupported at provider level (rare)
        "unsupported_parameters": [
            # مثال: "logit_bias"
        ],

        # -----------------------------
        # Per-model overrides (optional)
        # -----------------------------
        "models": {
            # مدل‌های preview معمولاً پارامترهای sampling (مثل temperature/top_p)
            # را نمی‌پذیرند. با این override تضمین می‌کنیم حذف شوند.
            "gpt-4o-search-preview-2025-03-11": {
                "supported_parameters": [
                    "model", "messages",
                    "max_tokens", "stop",
                    "stream", "response_format",
                ],
                "unsupported_parameters": [
                    "temperature", "top_p",
                    "presence_penalty", "frequency_penalty",
                ],
                "parameter_mapping": {
                    "max_tokens": "max_tokens",
                    "stop": "stop",
                    "stream": "stream",
                    "response_format": "response_format",
                },
                "default_parameters": {
                    "stream": True,
                },
            },

            # یک مدل عادی (Sampling آزاد)
            "gpt-4o-mini": {
                "supported_parameters": [
                    "model", "messages",
                    "temperature", "top_p",
                    "max_tokens", "stop",
                    "presence_penalty", "frequency_penalty",
                    "stream", "response_format",
                ],
                "unsupported_parameters": [],
                "parameter_mapping": {
                    "max_tokens": "max_tokens",
                    "temperature": "temperature",
                    "top_p": "top_p",
                    "presence_penalty": "presence_penalty",
                    "frequency_penalty": "frequency_penalty",
                    "stop": "stop",
                    "stream": "stream",
                    "response_format": "response_format",
                },
                "default_parameters": {
                    "stream": True,
                },
            },
        },
    },

    # در صورت نیاز، Providerهای دیگر (openai/anthropic/...) را نیز اضافه می‌کنیم.
    # "openai": { ... },
}

# -----------------------------
# Helper accessors (backward-compatible)
# -----------------------------
def get_provider_config(provider_name: str) -> Dict[str, Any]:
    """Return base provider config only (kept for backward compatibility)."""
    return PROVIDER_CONFIGS.get(provider_name.lower(), {})

def is_parameter_supported(provider_name: str, parameter: str) -> bool:
    """Check base provider whitelist (legacy)."""
    config = get_provider_config(provider_name)
    return parameter in config.get("supported_parameters", [])

def map_parameter(provider_name: str, parameter: str, value: Any):
    """Map parameter name for provider (legacy)."""
    config = get_provider_config(provider_name)
    mapping = config.get("parameter_mapping", {})
    mapped_param = mapping.get(parameter, parameter)
    return mapped_param, value

def get_default_parameters(provider_name: str) -> Dict[str, Any]:
    """Get base provider defaults (legacy)."""
    config = get_provider_config(provider_name)
    return config.get("default_parameters", {})

# -----------------------------
# New helpers (for per-model overrides)
# -----------------------------
def get_model_config(provider_name: str, model_id: str) -> Dict[str, Any]:
    """Return per-model override config if present, else empty dict."""
    provider_cfg = get_provider_config(provider_name)
    models = provider_cfg.get("models", {}) or {}
    return models.get(model_id, {})

def _merge_list(base: List[str], override: List[str]) -> List[str]:
    if not isinstance(base, list): base = []
    if not isinstance(override, list): override = []
    # model override wins when provided explicitly; fall back to base otherwise
    # Here we choose: if override exists (even empty list), we take it as-is.
    return override if override is not None else base

def _merge_dict(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base or {})
    out.update(override or {})
    return out

def resolve_config(provider_name: str, model_id: str) -> Dict[str, Any]:
    """
    Merge provider base config with per-model overrides.
    Keys: supported_parameters, unsupported_parameters, parameter_mapping, default_parameters.
    """
    provider_cfg = get_provider_config(provider_name) or {}
    model_cfg = get_model_config(provider_name, model_id) or {}

    supported = model_cfg.get("supported_parameters", provider_cfg.get("supported_parameters", []))
    unsupported = list(set(
        (provider_cfg.get("unsupported_parameters", []) or [])
        + (model_cfg.get("unsupported_parameters", []) or [])
    ))
    mapping = _merge_dict(provider_cfg.get("parameter_mapping", {}), model_cfg.get("parameter_mapping", {}))
    defaults = _merge_dict(provider_cfg.get("default_parameters", {}), model_cfg.get("default_parameters", {}))

    return {
        "supported_parameters": supported,
        "unsupported_parameters": unsupported,
        "parameter_mapping": mapping,
        "default_parameters": defaults,
    }
