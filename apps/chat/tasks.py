# backend/apps/chat/tasks.py

import logging
import re
from celery import shared_task
from django.db import transaction

# ✅ برای ارسال ایونت سبک وب‌سوکت بعد از ذخیره عنوان
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from apps.chat.models import Conversation, Message
from apps.gateway.service import get_provider

log = logging.getLogger(__name__)

SMART_TITLE_PROMPT = """
Analyze the following conversation snippet and generate a short, concise, and relevant title.
The title should be under 7 words and accurately reflect the main topic of the discussion.
Return only the title without quotes or punctuation at the end.
The title must be in the same language as the conversation.

Conversation Snippet:
---
{conversation_history}
---

Title:
"""

# -------- WebSocket helpers (سبک) --------
def _conv_group(cid: int) -> str:
    return f"conv_{cid}"

def _user_conversations_group(user_id=None, session_id=None):
    if user_id:
        return f"user_{user_id}_conversations"
    if session_id:
        return f"anon_{session_id}_conversations"
    return None

def _ws_emit(event: dict, *, conv_id: int, user_id=None, session_id=None):
    """
    payload سبک را هم به گروه خود کانورسیشن و هم گروه «لیست چت‌ها» می‌فرستد.
    """
    try:
        ch = get_channel_layer()
        # به گروه خود کانورسیشن (برای آپدیت هدر/تب عنوان)
        async_to_sync(ch.group_send)(
            _conv_group(conv_id),
            {"type": "stream.message", "event": event},
        )
        # به گروه لیست چت‌ها (برای آپدیت آیتم در لیست)
        ug = _user_conversations_group(user_id=user_id, session_id=session_id)
        if ug:
            async_to_sync(ch.group_send)(ug, {"type": "stream.message", "event": event})
        log.info(
            "WS emitted event=%s conv=%s user=%s session=%s",
            event.get("type"), conv_id, user_id, session_id
        )
    except Exception as e:
        log.warning("WS emit failed (conv=%s): %s", conv_id, e, exc_info=True)

# -------- Helpers (pure/side-effect free) --------

def _make_quick_title(text: str, max_len: int = 60) -> str:
    """
    - اولین جمله/خط معنادار را می‌گیرد
    - فاصله‌ها را تمیز می‌کند
    - به ۶۰ کاراکتر محدود می‌کند (درصورت نیاز با «…»)
    """
    if not text:
        log.debug("[quick_title] empty input text")
        return ""
    first = re.split(r"[\n\r]|[.!?\u061F]", text, maxsplit=1)[0].strip()
    if not first:
        first = text.strip()
    first = re.sub(r"\s+", " ", first)
    title = first if len(first) <= max_len else (first[: max_len - 1].rstrip() + "…")
    log.debug("[quick_title] result='%s'", title)
    return title


def _clean_title(raw: str, max_words: int = 7, max_len: int = 60) -> str:
    """
    - حذف کوتیشن‌های اضافی
    - حذف علائم انتهایی
    - محدود به ۷ کلمه و نهایتاً ۶۰ کاراکتر
    """
    if not raw:
        log.debug("[clean_title] empty raw title")
        return ""
    t0 = raw
    t = raw.strip().strip('"').strip("'").strip()
    t = re.sub(r"[\u200c\u200f\u200e]", "", t)  # حذف کاراکترهای نامرئی
    t = re.sub(r"\s+", " ", t)  # نرمال‌سازی فاصله‌ها
    t = re.sub(r'[—–\-:.,;!؟?،\s]+$', '', t).strip()  # حذف علائم انتهایی

    parts = t.split()
    if len(parts) > max_words:
        t = " ".join(parts[:max_words])

    if len(t) > max_len:
        t = t[: max_len - 1].rstrip() + "…"

    log.debug("[clean_title] raw='%s' => cleaned='%s'", t0, t)
    return t


def _extract_text_from_provider_response(result) -> str:
    """
    استخراج متن از فرمت‌های مختلف:
    - OpenAI-like dict: choices[0].message.content یا choices[0].delta/content/text
    - list[dict|str]: جمع‌آوری delta/content/text
    - dict: content/text/delta
    - str: همان
    """
    if result is None:
        log.debug("[extract] result=None")
        return ""

    # OpenAI-like dict
    if isinstance(result, dict) and "choices" in result:
        try:
            ch0 = result["choices"][0]
            # delta در استریم، message.content در نان‌استریم
            if "message" in ch0 and isinstance(ch0["message"], dict):
                content = ch0["message"].get("content")
                if content:
                    out = str(content).strip()
                    log.debug("[extract] openai-like message.content -> len=%s", len(out))
                    return out
            for key in ("delta", "content", "text"):
                if key in ch0:
                    out = str(ch0[key]).strip()
                    log.debug("[extract] openai-like %s -> len=%s", key, len(out))
                    return out
        except Exception:
            pass

    # لیست ایونت‌ها/اسلایس‌ها
    if isinstance(result, list):
        buf = []
        for ev in result:
            if isinstance(ev, dict):
                text = ev.get("content") or ev.get("text") or ev.get("delta")
                if text:
                    buf.append(str(text))
            elif isinstance(ev, str):
                buf.append(ev)
        out = "".join(buf).strip()
        log.debug("[extract] list -> len=%s preview='%s'", len(out), out[:120])
        return out

    # دیکشنری ساده
    if isinstance(result, dict):
        out = (result.get("content") or result.get("text") or result.get("delta") or "").strip()
        log.debug("[extract] dict -> len=%s preview='%s'", len(out), out[:120])
        return out

    # رشته
    if isinstance(result, str):
        out = result.strip()
        log.debug("[extract] str -> len=%s preview='%s'", len(out), out[:120])
        return out

    log.debug("[extract] unknown type: %s", type(result))
    return ""


# ✨====== تغییر اصلی برای حل مشکل SynchronousOnlyOperation اینجاست ======✨
@shared_task
def generate_and_save_smart_title_task(conversation_id: int):
    """A Celery task to generate (or upgrade) a smart title for a conversation."""

    def _sync_logic():
        log.info("SmartTitleTask start conv_id=%s", conversation_id)
        try:
            with transaction.atomic():
                log.debug("Fetching conversation with SELECT ... FOR UPDATE (conv_id=%s)", conversation_id)
                conv = Conversation.objects.select_for_update().get(id=conversation_id)

                message_count = conv.messages.filter(
                    role__in=[Message.Role.USER, Message.Role.ASSISTANT]
                ).count()
                log.info("Message count (USER/ASSISTANT) for conv=%s: %s", conversation_id, message_count)

                if message_count not in (1, 2, 5):
                    log.info("Skip smart title (conv=%s): message_count=%s not in (1,2,5)", conversation_id, message_count)
                    return

                recent_messages = list(conv.messages.order_by('-created_at')[:5])
                history_text = "\n".join(
                    f"{msg.get_role_display()}: {msg.content or ''}".strip()
                    for msg in reversed(recent_messages)
                ).strip()
                log.debug(
                    "History prepared (conv=%s): %s msgs, preview='%s'",
                    conversation_id, len(recent_messages), history_text[:200]
                )

                if not history_text:
                    log.info("No history available; skip smart title (conv=%s)", conversation_id)
                    return

                current_title = (conv.title or "").strip()
                first_user_msg = conv.messages.filter(role=Message.Role.USER).order_by('created_at').first()
                quick_title = _make_quick_title(first_user_msg.content if first_user_msg else "")
                normalized_current = re.sub(r"\s+", " ", current_title)
                normalized_quick   = re.sub(r"\s+", " ", quick_title)

                allow_overwrite = False
                if not current_title:
                    allow_overwrite = True
                elif normalized_current == normalized_quick:
                    allow_overwrite = True
                elif current_title.lower() in {"untitled chat", "untitled", "بدون عنوان"}:
                    allow_overwrite = True

                log.info(
                    "Overwrite check (conv=%s): allow=%s | current='%s' | quick='%s'",
                    conversation_id, allow_overwrite, current_title, quick_title
                )
                if not allow_overwrite:
                    log.info(
                        "Skip smart-title overwrite (conv=%s): user-edited title detected",
                        conversation_id
                    )
                    return

                prompt = SMART_TITLE_PROMPT.format(conversation_history=history_text)
                provider = get_provider()
                prov_name = getattr(provider, "name", "unknown")
                log.debug(
                    "Calling provider.generate (conv=%s, provider=%s) prompt_len=%s",
                    conversation_id, prov_name, len(prompt)
                )
                try:
                    result = provider.generate(
                        messages=[{"role": "user", "content": prompt}],
                        stream=False,
                    )
                except TypeError:
                    log.debug("Provider does not accept stream kw; retrying without it (conv=%s)", conversation_id)
                    result = provider.generate(messages=[{"role": "user", "content": prompt}])

                raw_title = _extract_text_from_provider_response(result)
                log.debug("Raw title (conv=%s): '%s'", conversation_id, raw_title)
                title = _clean_title(raw_title) or quick_title or "گفت‌وگوی جدید"
                log.info("Cleaned title (conv=%s): '%s'", conversation_id, title)

                if title:
                    old_title = conv.title
                    conv.title = title
                    conv.save(update_fields=["title"])
                    log.info(
                        "Title saved (conv=%s): new='%s' old='%s'",
                        conversation_id, title, old_title
                    )

                    sid = getattr(conv, "session_id", None)
                    _ws_emit(
                        event={
                            "type": "conversation.title_updated",
                            "conversation_id": conv.id,
                            "title": conv.title,
                        },
                        conv_id=conv.id,
                        user_id=getattr(conv.owner, "id", None),
                        session_id=str(sid) if sid else None,
                    )
                else:
                    log.warning(
                        "Empty/invalid title generated (conv=%s). Raw=%r",
                        conversation_id, raw_title
                    )

        except Conversation.DoesNotExist:
            log.error("Conversation not found (conv_id=%s) for title generation task.", conversation_id)
        except Exception as e:
            log.error("Error in smart title task (conv_id=%s): %s", conversation_id, e, exc_info=True)
        finally:
            log.info("SmartTitleTask end conv_id=%s", conversation_id)

    # فراخوانی تابع داخلی به صورت همزمان (sync)
    _sync_logic()

# ✨====== پایان تغییرات ======✨