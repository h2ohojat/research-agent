# apps/gateway/service.py
import os
import logging
from .providers.fake import FakeProvider
from .providers.avalai import AvalaiProvider

logger = logging.getLogger(__name__)

REGISTRY = {
    "fake": FakeProvider,
    "avalai": AvalaiProvider,
}

def get_provider(name: str | None = None):
    selected = (name or os.getenv("DEFAULT_PROVIDER")).lower() if (name or os.getenv("DEFAULT_PROVIDER")) else None
    if not selected:
        # به جای fallback خاموش، خطای واضح بده
        raise RuntimeError("No provider specified. Set DEFAULT_PROVIDER or pass name to get_provider()")

    if selected not in REGISTRY:
        raise RuntimeError(f"Unknown provider '{selected}'. Valid: {', '.join(REGISTRY)}")

    cls = REGISTRY[selected]
    try:
        provider = cls()
        logger.info("✅ Provider selected: %s", selected)
        return provider
    except Exception as e:
        logger.exception("💥 Provider init failed for '%s': %s", selected, e)
        raise
