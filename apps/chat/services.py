from typing import List, Dict, Any
import time
import logging  # ✨ اضافه شده برای لاگ‌گیری بهتر
import re

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from apps.chat.models import Message, Conversation  # ✨ Conversation اضافه شد برای به‌روزرسانی عنوان
from apps.gateway.service import get_provider
# from django.utils.text import Truncator # ✨ این خط دیگر لازم نیست و حذف می‌شود

# ✨ تسک جدید Celery را از فایل tasks.py در همین اپلیکیشن وارد می‌کنیم
from .tasks import generate_and_save_smart_title_task 

log = logging.getLogger(__name__) # ✨ یک نمونه لاگر ایجاد می‌کنیم


def _group_name(message_id: int) -> str:
    return f"msg_{message_id}"


def _group_send(group: str, payload: Dict[str, Any]) -> None:
    ch = get_channel_layer()
    async_to_sync(ch.group_send)(group, {"type": "stream.message", "event": payload})


def _make_quick_title(text: str, max_len: int = 60) -> str:
    """
    ✨ عنوان سریع و سبک از متن کاربر می‌سازد تا به‌جای «Untitled chat» فوراً نمایش داده شود.
    - اولین جمله/خط غیرخالی را برمی‌دارد.
    - فاصله‌های اضافه را تمیز می‌کند.
    - تا حداکثر max_len کاراکتر برش می‌زند (درصورت نیاز با «…»).
    """
    if not text:
        return ""
    # اولین خط/جملهٔ معنادار
    first = re.split(r"[\n\r]|[.!?\u061F]", text, maxsplit=1)[0].strip()
    if not first:
        first = text.strip()
    # تمیز کردن فاصله‌ها
    first = re.sub(r"\s+", " ", first)
    if len(first) <= max_len:
        return first
    return first[: max_len - 1].rstrip() + "…"


@transaction.atomic
def run_generation(message_id: int) -> None:
    """
    پیام کاربر را برمی‌دارد، وضعیت را به STREAMING می‌برد،
    توکن‌ها را تولید می‌کند و رویدادها را به group می‌فرستد.
    """
    msg = Message.objects.select_for_update().select_related("conversation").get(id=message_id)
    group = _group_name(message_id)
    start_ts = time.perf_counter()

    # ✨ اگر این اولین پیام گفتگوست یا هنوز عنوانی ندارد،
    # یک «عنوان سریع» بلافاصله از متن کاربر ست می‌کنیم (فقط اگر هنوز خالی است)
    if not (msg.conversation.title or "").strip():
        quick_title = _make_quick_title(msg.content or "")
        if quick_title:
            # فقط اگر همچنان خالی باشد (شرط در DB) آپدیت کن تا از رقابت جلوگیری شود
            Conversation.objects.filter(id=msg.conversation_id, title__in=["", None]).update(title=quick_title)
            log.info(f"Set quick conversation title for {msg.conversation_id!r}: {quick_title!r}")

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
            model=requested_model,
            stream=True,
        ):
            if ev.get("type") == "token":
                delta = ev.get("delta", "")
                if not delta:
                    continue
                parts.append(delta)
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
    Message.objects.create(
        conversation=msg.conversation,
        role=Message.Role.ASSISTANT,
        content=final_text,
        status=Message.Status.DONE,
        tokens_output=len(final_text or ""),
        latency_ms=int((time.perf_counter() - start_ts) * 1000),
        provider=getattr(provider, "name", "unknown"),
        model_name=model_used,
    )

    # --- ✨ START: CELERY TASK FOR SMART TITLE ✨ ---
    # تولید عنوان هوشمند (با نگاه به پیام/پاسخ) در پس‌زمینه؛
    # اگر عنوان سریع قبلاً ست شده باشد، این تسک می‌تواند آن را به نسخهٔ بهتر ارتقا دهد.
    generate_and_save_smart_title_task.delay(msg.conversation.id)
    log.info(f"Queued smart title generation task for conversation {msg.conversation.id}.")
    # --- ✨ END: CELERY TASK FOR SMART TITLE ✨ ---

    # اتمام پیام کاربر
    msg.status = Message.Status.DONE
    msg.save(update_fields=["status"])

    _group_send(group, {"type": "done"})
