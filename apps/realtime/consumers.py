# apps/realtime/consumers.py
import json
import logging
import asyncio
import re
from typing import Any, Dict, Optional, Iterable

from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

from apps.gateway.service import get_provider  # avalai/fake/...
logger = logging.getLogger(__name__)

# ========= اضافه‌ها برای ذخیره‌سازی (بدون حذف چیزی از کد شما) =========
from django.core.exceptions import FieldDoesNotExist
from apps.chat.models import Conversation, Message
from apps.chat.tasks import generate_and_save_smart_title_task


# ======================================================================
# Utilities / Mixin
# ======================================================================

class JsonSendMixin:
    async def send_json(self, obj: Dict[str, Any]):
        """ارسال امن JSON به کلاینت (با لاگ خطا در صورت شکست)."""
        try:
            await self.send(text_data=json.dumps(obj, ensure_ascii=False))
        except Exception as e:
            logger.exception("Failed to send WS JSON: %s", e)

    async def _send_error(self, message: str, error_type: str = "error"):
        """ارسال خطای استاندارد سازگار با websocket.js فرانت‌اند."""
        logger.error("WS error (%s): %s", error_type, message)
        await self.send_json({
            "type": "error",
            "error": message,
            "error_type": error_type
        })


# ======================================================================
# 1) EchoConsumer — ساده برای تست WS (بدون Provider)
# ======================================================================

class EchoConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send_json({"type": "connected"})
        logger.info("[Echo] connected: %s", self.scope.get("client"))

    async def disconnect(self, code):
        logger.info("[Echo] disconnected: %s code=%s", self.scope.get("client"), code)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception as e:
            await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload")
            return

        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        # هر پیام را به‌صورت استریم‌نما echo می‌کنیم
        await self.send_json({"type": "started"})
        await self.send_json({"type": "token", "delta": f"ECHO: {data!r}"})
        await self.send_json({"type": "done", "finish_reason": "completed"})


# ======================================================================
# 2) MessageStreamConsumer — استریم آزمایشی (بدون Provider)
# ======================================================================

class MessageStreamConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send_json({"type": "connected"})
        logger.info("[MsgStream] connected: %s", self.scope.get("client"))

    async def disconnect(self, code):
        logger.info("[MsgStream] disconnected: %s code=%s", self.scope.get("client"), code)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception as e:
            await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload")
            return

        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if msg_type != "chat_message":
            await self._send_error(f"Unknown message type: {msg_type}", error_type="unknown_type")
            return

        content = (data.get("content") or "").strip()
        if not content:
            await self._send_error("Empty content.", error_type="input_validation")
            return

        await self.send_json({"type": "started"})

        # محتوا را به قطعات کوچک تقسیم و به شکل token ارسال می‌کنیم
        chunks: Iterable[str] = (content[i:i+8] for i in range(0, len(content), 8))
        try:
            for ch in chunks:
                await asyncio.sleep(0.02)  # تاخیر کوچک برای حس استریم
                await self.send_json({"type": "token", "delta": ch})
            await self.send_json({"type": "done", "finish_reason": "completed"})
        except Exception as e:
            logger.exception("[MsgStream] unexpected error")
            await self._send_error(f"Unexpected error: {e}", error_type="unexpected")


# ======================================================================
# 3) ChatStreamConsumer — استریم واقعی با Provider (Avalai و ...)
# ======================================================================

def _quick_title(text: str, max_len: int = 60) -> str:
    """یک عنوان سریع از اولین جمله/خط بساز (برای نمایش فوری در سایدبار)."""
    if not text:
        return "Untitled chat"
    first = re.split(r"[\n\r]|[.!?\u061F]", text, maxsplit=1)[0].strip() or text.strip()
    first = re.sub(r"\s+", " ", first)
    return first if len(first) <= max_len else (first[: max_len - 1].rstrip() + "…")


def _has_field(model_cls, name: str) -> bool:
    try:
        model_cls._meta.get_field(name)
        return True
    except FieldDoesNotExist:
        return False


def _enum_member(cls, enum_name: str, member: str, default):
    enum_cls = getattr(cls, enum_name, None)
    return getattr(enum_cls, member, default) if enum_cls else default


class ChatStreamConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    """
    WS endpoint: /ws/chat/

    ورودی از فرانت:
      {
        "type": "chat_message",
        "content": "سلام",
        "model": "gpt-4o-mini",
        "conversation_id": null,
        "deep_search": false,
        "params": { "temperature": 0.7 },
        "provider": "avalai"
      }

    خروجی به فرانت: connected | started | token | done | error | pong
    """

    # ----------------- ORM helpers (sync→async) -----------------

    @sync_to_async
    def _create_conversation(self, model: Optional[str]) -> Optional[Conversation]:
        """
        ساخت کانورسیشن با احترام به اسکیمای واقعی DB:
        - فقط فیلدهایی که وجود دارند ست می‌شود (owner, model_name/model/llm_model/...)
        - اگر ساخت با هر دلیلی شکست بخورد، None برمی‌گردد و استریم ادامه پیدا می‌کند.
        """
        user = self.scope.get("user")
        owner = user if getattr(user, "is_authenticated", False) else None

        kwargs = {}
        if owner and _has_field(Conversation, "owner"):
            kwargs["owner"] = owner

        # یک فیلد مرتبط با «نام مدل» اگر وجود داشت:
        for fname in ("model_name", "model", "llm_model", "model_key", "model_slug"):
            if _has_field(Conversation, fname):
                kwargs[fname] = (model or "")
                break

        try:
            conv = Conversation.objects.create(**kwargs)
            logger.info("[ChatStream] Conversation created id=%s owner=%s", conv.id, getattr(owner, "id", None))
            return conv
        except Exception as e:
            logger.warning("[ChatStream] Could not create Conversation (fallback to stateless). Error: %s", e)
            return None

    @sync_to_async
    def _get_conversation(self, conv_id: int) -> Conversation:
        return Conversation.objects.get(id=conv_id)

    @sync_to_async
    def _create_user_message(
        self,
        conv: Conversation,
        content: str,
        provider: Optional[str],
        model: Optional[str],
    ) -> Optional[Message]:
        if conv is None:
            return None

        kwargs = {"conversation": conv}
        # role
        role_value = _enum_member(Message, "Role", "USER", "user")
        if _has_field(Message, "role"):
            kwargs["role"] = role_value
        # content
        if _has_field(Message, "content"):
            kwargs["content"] = content

        # status
        status_value = _enum_member(Message, "Status", "DONE", "done")
        if _has_field(Message, "status"):
            kwargs["status"] = status_value

        # provider/model
        for fname, val in (
            ("provider", provider or ""),
            ("provider_name", provider or ""),
            ("model_name", model or ""),
            ("model", model or ""),
            ("llm_model", model or ""),
        ):
            if _has_field(Message, fname):
                kwargs[fname] = val

        # token counters (اختیاری)
        for fname, val in (
            ("tokens_input", len(content or "")),
            ("input_tokens", len(content or "")),
        ):
            if _has_field(Message, fname):
                kwargs[fname] = val

        try:
            msg = Message.objects.create(**kwargs)
            logger.info("[ChatStream] User message saved id=%s conv=%s", getattr(msg, "id", None), getattr(conv, "id", None))
            return msg
        except Exception as e:
            logger.warning("[ChatStream] Could not save user message (continue streaming). Error: %s", e)
            return None

    @sync_to_async
    def _create_assistant_message(
        self,
        conv: Conversation,
        text: str,
        provider: Optional[str],
        model: Optional[str],
        latency_ms: int,
    ) -> Optional[Message]:
        if conv is None:
            return None

        kwargs = {"conversation": conv}

        # role
        role_value = _enum_member(Message, "Role", "ASSISTANT", "assistant")
        if _has_field(Message, "role"):
            kwargs["role"] = role_value

        # content
        if _has_field(Message, "content"):
            kwargs["content"] = text

        # status
        status_value = _enum_member(Message, "Status", "DONE", "done")
        if _has_field(Message, "status"):
            kwargs["status"] = status_value

        # provider/model
        for fname, val in (
            ("provider", provider or ""),
            ("provider_name", provider or ""),
            ("model_name", model or ""),
            ("model", model or ""),
            ("llm_model", model or ""),
        ):
            if _has_field(Message, fname):
                kwargs[fname] = val

        # tokens/latency (اختیاری)
        for fname, val in (
            ("tokens_output", len(text or "")),
            ("output_tokens", len(text or "")),
            ("latency_ms", latency_ms),
            ("latency", latency_ms),
        ):
            if _has_field(Message, fname):
                kwargs[fname] = val

        try:
            msg = Message.objects.create(**kwargs)
            logger.info("[ChatStream] Assistant message saved id=%s conv=%s", getattr(msg, "id", None), getattr(conv, "id", None))
            return msg
        except Exception as e:
            logger.warning("[ChatStream] Could not save assistant message (continue). Error: %s", e)
            return None

    # ----------------- lifecycle -----------------

    async def connect(self):
        await self.accept()
        await self.send_json({"type": "connected"})
        logger.info("[ChatStream] connected: %s", self.scope.get("client"))

    async def disconnect(self, code):
        logger.info("[ChatStream] disconnected: %s code=%s", self.scope.get("client"), code)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception as e:
            await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload")
            return

        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if msg_type != "chat_message":
            logger.warning("[ChatStream] Unknown message type: %r", msg_type)
            await self._send_error(f"Unknown message type: {msg_type}", error_type="unknown_type")
            return

        content: str = (data.get("content") or "").strip()
        model: Optional[str] = data.get("model")
        params: Dict[str, Any] = data.get("params") or {}
        provider_name: Optional[str] = data.get("provider")
        conversation_id: Optional[int] = data.get("conversation_id")

        if not content:
            await self._send_error("Empty content.", error_type="input_validation")
            return
        if not model or not isinstance(model, str):
            await self._send_error("No model selected.", error_type="input_validation")
            return

        # ساخت Provider با گزارش خطای شفاف
        try:
            provider = await sync_to_async(get_provider)(provider_name)
        except Exception as e:
            await self._send_error(f"Provider init failed: {e}", error_type="provider_init")
            return

        # اطمینان از Conversation (دفاعی و غیرمسدودکننده)
        conv: Optional[Conversation] = None
        if conversation_id:
            try:
                conv = await self._get_conversation(int(conversation_id))
            except Exception:
                await self._send_error("Conversation not found.", error_type="not_found")
                return
        else:
            conv = await self._create_conversation(model=model)
            if conv is not None:
                # فقط اگر واقعاً ساخته شد
                await self.send_json({
                    "type": "ConversationCreated",
                    "conversation_id": conv.id,
                    "title": _quick_title(content),
                })
            else:
                logger.info("[ChatStream] Proceeding without Conversation (stateless mode).")

        # ذخیره پیام کاربر (در صورت وجود conv)
        try:
            await self._create_user_message(conv, content, provider_name, model)
        except Exception as e:
            logger.warning("[ChatStream] User message save failed (non-fatal): %s", e)

        # استریم
        messages = [{"role": "user", "content": content}]
        await self._stream_generate(provider, messages, model, params, conv, provider_name)

    # ----------------- Helpers -----------------

    async def _stream_generate(self, provider, messages, model: str, params: Dict[str, Any],
                               conv: Optional[Conversation], provider_name: Optional[str]):
        """
        استریم امن و سازگار با فرانت:
          - eventهای provider (started/token/done/error) همان‌طور که هستند پاس می‌شوند
          - پایان طبیعی استریم در Python 3.13 (RuntimeError wrap) هندل می‌شود
          - پاسخ کامل برای ذخیره‌سازی بافر می‌شود (اگر conv داشتیم)
        """
        buffer_parts = []
        await self.send_json({"type": "started"})
        t0 = asyncio.get_event_loop().time()

        try:
            gen = provider.generate(messages=messages, model=model, params=params, stream=True)

            while True:
                try:
                    event = await asyncio.to_thread(next, gen)
                except StopIteration:
                    break
                except RuntimeError as e:
                    if "StopIteration interacts badly with generators" in str(e):
                        break
                    await self._send_error(f"Stream iteration failed: {e}", error_type="stream_iteration")
                    return
                except Exception as e:
                    await self._send_error(f"Stream iteration failed: {e}", error_type="stream_iteration")
                    return

                if not isinstance(event, dict) or "type" not in event:
                    await self._send_error("Malformed event from provider.", error_type="event_format")
                    return

                etype = event.get("type")
                if etype == "token":
                    delta = event.get("delta") or ""
                    buffer_parts.append(delta)
                    event["delta"] = delta
                await self.send_json(event)

            # پایان و ذخیره‌سازی
            final_text = "".join(buffer_parts)
            t1 = asyncio.get_event_loop().time()
            latency_ms = int((t1 - t0) * 1000)

            # فقط اگر conv داریم
            if conv is not None:
                try:
                    await self._create_assistant_message(
                        conv=conv,
                        text=final_text,
                        provider=provider_name,
                        model=model,
                        latency_ms=latency_ms,
                    )
                    try:
                        generate_and_save_smart_title_task.delay(conv.id)
                        logger.info("[ChatStream] queued smart title task conv=%s", conv.id)
                    except Exception as e:
                        logger.warning("[ChatStream] could not queue smart title task: %s", e)
                except Exception as e:
                    logger.warning("[ChatStream] Assistant message save failed (non-fatal): %s", e)

            # send done (در بعضی providerها خودش می‌آید، باز هم Idempotent است)
            await self.send_json({"type": "done", "finish_reason": "completed"})

        except Exception as e:
            logger.exception("[ChatStream] unexpected streaming error")
            await self._send_error(f"Unexpected error: {e}", error_type="unexpected")
