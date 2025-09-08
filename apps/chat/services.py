from typing import List, Dict, Any
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from apps.chat.models import Message
from apps.gateway.service import get_provider
from django.utils.text import Truncator
import time


def _group_name(message_id: int) -> str:
    return f"msg_{message_id}"


def _group_send(group: str, payload: Dict[str, Any]) -> None:
    ch = get_channel_layer()
    async_to_sync(ch.group_send)(group, {"type": "stream.message", "event": payload})


@transaction.atomic
def run_generation(message_id: int) -> None:
    """
    پیام کاربر را برمی‌دارد، وضعیت را به STREAMING می‌برد،
    توکن‌ها را تولید می‌کند و رویدادها را به group می‌فرستد.
    """
    msg = Message.objects.select_for_update().select_related("conversation").get(id=message_id)
    group = _group_name(message_id)
    start_ts = time.perf_counter()

    # شروع استریم و ثبت ورودی تقریبی
    if msg.tokens_input is None:
        msg.tokens_input = len(msg.content or "")
    msg.status = Message.Status.STREAMING
    msg.save(update_fields=["status", "tokens_input"])

    _group_send(group, {"type": "started"})

    # انتخاب Provider/Model براساس پیام کاربر
    requested_provider = (msg.provider or "").strip() or None
    requested_model = (msg.model_name or "").strip() or None
    provider = get_provider(requested_provider)

    parts: List[str] = []
    seq = 0

    try:
        for ev in provider.generate(
            messages=[{"role": "user", "content": msg.content}],
            model=requested_model,   # ← مدل انتخابی کاربر (اگر None باشد، Provider خودش default را استفاده می‌کند)
            stream=True,
        ):
            if ev.get("type") == "token":
                delta = ev.get("delta", "")
                if not delta:
                    continue
                parts.append(delta)
                # seq محلی اگر provider نداد
                _group_send(group, {"type": "token", "delta": delta, "seq": ev.get("seq", seq)})
                seq += 1
    except Exception as e:
        msg.status = Message.Status.FAILED
        msg.save(update_fields=["status"])
        _group_send(group, {"type": "error", "error": "provider_error", "detail": str(e)})
        return

    final_text = "".join(parts)

    # مدل نهایی که باید در تلمتری ثبت شود (اولویت با انتخاب کاربر)
    model_used = requested_model or getattr(provider, "default_model", None)

    # ساخت پیام دستیار + تلمتری
    assistant_msg = Message.objects.create(
        conversation=msg.conversation,
        role=Message.Role.ASSISTANT,
        content=final_text,
        status=Message.Status.DONE,
        tokens_output=len(final_text or ""),                       # تقریبی؛ بعداً می‌توان با usage دقیق کرد
        latency_ms=int((time.perf_counter() - start_ts) * 1000),   # ms
        provider=getattr(provider, "name", "unknown"),
        model_name=model_used,
    )

    # عنوان خودکار گفتگو (اگر خالی است)
    conv = msg.conversation
    if not conv.title:
        title_source = (final_text or msg.content or "").strip()
        conv.title = Truncator(title_source).chars(60)  # حداکثر ۶۰ کاراکتر
        conv.save(update_fields=["title"])

    # اتمام پیام کاربر
    msg.status = Message.Status.DONE
    msg.save(update_fields=["status"])

    _group_send(group, {"type": "done"})
