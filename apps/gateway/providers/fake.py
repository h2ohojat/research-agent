from typing import Iterable, Dict, Any, List
from .base import BaseProvider

class FakeProvider(BaseProvider):
    name = "fake"
    region = "ir"

    def generate(
        self,
        messages: List[Dict[str, str]],
        model: str | None = None,
        params: Dict[str, Any] | None = None,
        stream: bool = True,
    ) -> Iterable[Dict[str, Any]]:
        # پاسخ ساختگی بر اساس آخرین پیام کاربر
        prompt = ""
        if messages:
            prompt = messages[-1].get("content", "")

        # شروع
        yield {"type": "started", "provider": self.name, "model": model or "fake-1"}

        # یک پاسخ ساده‌ی توکنی‌شده
        text = f"echo: {prompt}".strip() or "hello from fake"
        for i, ch in enumerate(text.split(" ")):
            yield {"type": "token", "delta": (ch + (" " if i < len(text.split(' ')) - 1 else "")), "seq": i}

        # پایان
        yield {"type": "done", "finish_reason": "stop"}
