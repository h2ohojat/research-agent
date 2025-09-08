import os
import json
from typing import Any, Dict, Iterable, List, Optional

import requests

# اگر BaseProvider داری از آن ارث‌بری کن؛ وگرنه همین امضا کافی است.
class AvalaiProvider:
    """
    OpenAI-compatible provider for AvalAI.
    Expects:
      - AVALAI_BASE_URL (default: https://api.avalai.ir/v1)
      - AVALAI_API_KEY
      - AVALAI_MODEL (fallback model name)
    """
    name = "avalai"
    def __init__(self) -> None:
        self.base_url = os.getenv("AVALAI_BASE_URL", "https://api.avalai.ir/v1").rstrip("/")
        self.api_key = os.getenv("AVALAI_API_KEY")
        self.default_model = os.getenv("AVALAI_MODEL", "gpt-4o-mini")
        if not self.api_key:
            raise RuntimeError("AVALAI_API_KEY is not set")

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def generate(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        stream: bool = True,
        **kwargs: Any,
    ) -> Iterable[Dict[str, Any]]:
        """
        Yields: {"type": "token", "delta": str, "seq": int}
        """
        url = f"{self.base_url}/chat/completions"
        payload: Dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "stream": True,  # همیشه استریم می‌گیریم
        }
        # گزینه‌های اضافی (مثل temperature و ...)
        payload.update({k: v for k, v in kwargs.items() if v is not None})

        with requests.post(
            url,
            headers=self._headers(),
            json=payload,
            stream=True,
            timeout=(10, 300),  # connect, read
        ) as resp:
            resp.raise_for_status()
            seq = 0
            for raw in resp.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                # OpenAI-compatible streams are "data: {...}" and end with "[DONE]"
                if raw.startswith("data: "):
                    data = raw[6:]
                else:
                    data = raw

                if data.strip() == "[DONE]":
                    break

                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue

                # ساختار OpenAI: choices[0].delta.content
                choices = obj.get("choices") or []
                if not choices:
                    continue
                delta_obj = choices[0].get("delta") or {}
                delta_text = delta_obj.get("content")
                if delta_text:
                    yield {"type": "token", "delta": delta_text, "seq": seq}
                    seq += 1
