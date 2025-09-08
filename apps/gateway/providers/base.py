from typing import Iterable, Dict, Any, List

class BaseProvider:
    name: str = "base"
    region: str = "ir"  # در آینده برای روتینگ صف کاربرد دارد

    def generate(
        self,
        messages: List[Dict[str, str]],
        model: str | None = None,
        params: Dict[str, Any] | None = None,
        stream: bool = True,
    ) -> Iterable[Dict[str, Any]]:
        """
        باید یک ژنراتور برگرداند که دیکشنری‌های رویداد را yield می‌کند:
        {"type":"started"} -> {"type":"token","delta":"..."}... -> {"type":"done"}
        """
        raise NotImplementedError
