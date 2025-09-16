# apps/realtime/consumers.py
import json
import logging
import asyncio
import re
import uuid
from typing import Any, Dict, Optional, Iterable

from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.conf import settings as django_settings

from apps.gateway.service import get_provider
logger = logging.getLogger(__name__)

from django.core.exceptions import FieldDoesNotExist
from apps.chat.models import Conversation, Message
from apps.chat.tasks import generate_and_save_smart_title_task

# ======================================================================
# Utilities / Mixin (بدون تغییر)
# ======================================================================

class JsonSendMixin:
    async def send_json(self, obj: Dict[str, Any]):
        try:
            await self.send(text_data=json.dumps(obj, ensure_ascii=False))
        except Exception as e:
            logger.exception("Failed to send WS JSON: %s", e)

    async def _send_error(self, message: str, error_type: str = "error"):
        logger.error("WS error (%s): %s", error_type, message)
        await self.send_json({"type": "error", "error": message, "error_type": error_type})

# ======================================================================
# Consumer های تستی (بدون تغییر)
# ======================================================================

class EchoConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send_json({"type": "connected"})
        logger.info("[Echo] connected: %s", self.scope.get("client"))

    async def disconnect(self, code):
        logger.info("[Echo] disconnected: %s code=%s", self.scope.get("client"), code)

    async def receive(self, text_data=None, bytes_data=None):
        try: data = json.loads(text_data or "{}")
        except Exception as e: await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload"); return
        if data.get("type") == "ping": await self.send_json({"type": "pong"}); return
        await self.send_json({"type": "started"})
        await self.send_json({"type": "token", "delta": f"ECHO: {data!r}"})
        await self.send_json({"type": "done", "finish_reason": "completed"})

class MessageStreamConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send_json({"type": "connected"})
        logger.info("[MsgStream] connected: %s", self.scope.get("client"))

    async def disconnect(self, code):
        logger.info("[MsgStream] disconnected: %s code=%s", self.scope.get("client"), code)

    async def receive(self, text_data=None, bytes_data=None):
        try: data = json.loads(text_data or "{}")
        except Exception as e: await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload"); return
        msg_type = data.get("type")
        if msg_type == "ping": await self.send_json({"type": "pong"}); return
        if msg_type != "chat_message": await self._send_error(f"Unknown message type: {msg_type}", error_type="unknown_type"); return
        content = (data.get("content") or "").strip()
        if not content: await self._send_error("Empty content.", error_type="input_validation"); return
        await self.send_json({"type": "started"})
        chunks: Iterable[str] = (content[i:i+8] for i in range(0, len(content), 8))
        try:
            for ch in chunks:
                await asyncio.sleep(0.02)
                await self.send_json({"type": "token", "delta": ch})
            await self.send_json({"type": "done", "finish_reason": "completed"})
        except Exception as e:
            logger.exception("[MsgStream] unexpected error")
            await self._send_error(f"Unexpected error: {e}", error_type="unexpected")

# ======================================================================
# 3) ChatStreamConsumer — بازنویسی شده با الگوی Actor/Mailbox (صف)
# ======================================================================

def _quick_title(text: str, max_len: int = 60) -> str:
    if not text: return "Untitled chat"
    first = re.split(r"[\n\r]|[.!?\u061F]", text, maxsplit=1)[0].strip() or text.strip()
    first = re.sub(r"\s+", " ", first)
    return first if len(first) <= max_len else (first[: max_len - 1].rstrip() + "…")

def _has_field(model_cls, name: str) -> bool:
    try: model_cls._meta.get_field(name); return True
    except FieldDoesNotExist: return False

def _enum_member(cls, enum_name: str, member: str, default):
    enum_cls = getattr(cls, enum_name, None)
    return getattr(enum_cls, member, default) if enum_cls else default

class ChatStreamConsumer(JsonSendMixin, AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conn_id = uuid.uuid4().hex[:8]
        # <<< CHANGE: متغیرهای جدید برای معماری صف
        self.inbox: Optional[asyncio.Queue] = None
        self.runner_task: Optional[asyncio.Task] = None
        self.current_stream_task: Optional[asyncio.Task] = None
        # <<< FIX: خواندن تنظیمات در اینجا امن است، نه در سطح ماژول
        self.max_stream_seconds = getattr(django_settings, "REALTIME_MAX_SECONDS", 120)

    # ---------- ORM helpers (بدون تغییر) ----------
    @sync_to_async
    def _create_conversation(self, model: Optional[str]) -> Optional[Conversation]:
        user = self.scope.get("user")
        owner = user if getattr(user, "is_authenticated", False) else None
        kwargs = {}
        if owner and _has_field(Conversation, "owner"): kwargs["owner"] = owner
        for fname in ("model_name", "model", "llm_model", "model_key", "model_slug"):
            if _has_field(Conversation, fname): kwargs[fname] = (model or ""); break
        try:
            conv = Conversation.objects.create(**kwargs)
            logger.info("[ChatStream %s] Conversation created id=%s owner=%s", self.conn_id, conv.id, getattr(owner, "id", None))
            return conv
        except Exception as e:
            logger.warning("[ChatStream %s] Could not create Conversation. Error: %s", self.conn_id, e); return None

    @sync_to_async
    def _get_conversation(self, conv_id: int) -> Conversation:
        return Conversation.objects.get(id=conv_id)

    @sync_to_async
    def _create_user_message(self, conv: Conversation, content: str, provider: Optional[str], model: Optional[str]) -> Optional[Message]:
        if conv is None: return None
        kwargs = {"conversation": conv}
        if _has_field(Message, "role"): kwargs["role"] = _enum_member(Message, "Role", "USER", "user")
        if _has_field(Message, "content"): kwargs["content"] = content
        if _has_field(Message, "status"): kwargs["status"] = _enum_member(Message, "Status", "DONE", "done")
        for fname, val in [("provider", provider), ("provider_name", provider), ("model_name", model), ("model", model), ("llm_model", model)]:
            if _has_field(Message, fname): kwargs[fname] = (val or "")
        for fname, val in [("tokens_input", len(content)), ("input_tokens", len(content))]:
            if _has_field(Message, fname): kwargs[fname] = val
        try:
            msg = Message.objects.create(**kwargs)
            logger.info("[ChatStream %s] User message saved id=%s conv=%s", self.conn_id, getattr(msg, "id", None), getattr(conv, "id", None))
            return msg
        except Exception as e:
            logger.warning("[ChatStream %s] Could not save user message. Error: %s", self.conn_id, e); return None

    @sync_to_async
    def _create_assistant_message(self, conv: Conversation, text: str, provider: Optional[str], model: Optional[str], latency_ms: int) -> Optional[Message]:
        if conv is None: return None
        kwargs = {"conversation": conv}
        if _has_field(Message, "role"): kwargs["role"] = _enum_member(Message, "Role", "ASSISTANT", "assistant")
        if _has_field(Message, "content"): kwargs["content"] = text
        if _has_field(Message, "status"): kwargs["status"] = _enum_member(Message, "Status", "DONE", "done")
        for fname, val in [("provider", provider), ("provider_name", provider), ("model_name", model), ("model", model), ("llm_model", model)]:
            if _has_field(Message, fname): kwargs[fname] = (val or "")
        for fname, val in [("tokens_output", len(text)), ("output_tokens", len(text)), ("latency_ms", latency_ms), ("latency", latency_ms)]:
            if _has_field(Message, fname): kwargs[fname] = val
        try:
            msg = Message.objects.create(**kwargs)
            logger.info("[ChatStream %s] Assistant message saved id=%s conv=%s", self.conn_id, getattr(msg, "id", None), getattr(conv, "id", None))
            return msg
        except Exception as e:
            logger.warning("[ChatStream %s] Could not save assistant message. Error: %s", self.conn_id, e); return None

    # ---------- Lifecycle (بازنویسی شده با معماری صف) ----------
    async def connect(self):
        await self.accept()
        self.inbox = asyncio.Queue()
        self.runner_task = asyncio.create_task(self._runner())
        await self.send_json({"type": "connected"})
        logger.info("[ChatStream %s] connected. Actor runner task started.", self.conn_id)

    async def disconnect(self, code):
        logger.info("[ChatStream %s] disconnect called (code=%s)", self.conn_id, code)
        if self.runner_task and not self.runner_task.done():
            self.runner_task.cancel()
        if self.current_stream_task and not self.current_stream_task.done():
            self.current_stream_task.cancel()
        logger.info("[ChatStream %s] disconnected. All tasks cancelled.", self.conn_id)

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

        if msg_type == "cancel":
            if self.current_stream_task and not self.current_stream_task.done():
                self.current_stream_task.cancel()
                logger.info("[ChatStream %s] Client requested stream cancellation.", self.conn_id)
            return

        if msg_type != "chat_message":
            await self._send_error(f"Unknown message type: {msg_type}", error_type="unknown_type")
            return

        await self.inbox.put(data)

    async def _runner(self):
        try:
            while True:
                data = await self.inbox.get()
                self.current_stream_task = asyncio.create_task(self._handle_chat_message(data))
                try:
                    await self.current_stream_task
                finally:
                    self.current_stream_task = None
                    self.inbox.task_done()
        except asyncio.CancelledError:
            logger.info("[ChatStream %s] Runner task is shutting down.", self.conn_id)
        except Exception:
            logger.exception("[ChatStream %s] Unhandled exception in runner task.", self.conn_id)

    # ---------- Handlers (منطق اصلی بدون تغییر) ----------
    async def _handle_chat_message(self, data: Dict[str, Any]):
        content = (data.get("content") or "").strip()
        model, params, provider_name, conversation_id = data.get("model"), data.get("params", {}), data.get("provider"), data.get("conversation_id")
        if not content: await self._send_error("Empty content.", error_type="input_validation"); return
        if not model or not isinstance(model, str): await self._send_error("No model selected.", error_type="input_validation"); return

        try: provider = await sync_to_async(get_provider)(provider_name)
        except Exception as e: await self._send_error(f"Provider init failed: {e}", error_type="provider_init"); return

        conv: Optional[Conversation] = None
        if conversation_id:
            try: conv = await self._get_conversation(int(conversation_id))
            except Exception: await self._send_error("Conversation not found.", error_type="not_found"); return
        else:
            conv = await self._create_conversation(model=model)
            if conv is not None: await self.send_json({"type": "ConversationCreated", "conversation_id": conv.id, "title": _quick_title(content)})

        try: await self._create_user_message(conv, content, provider_name, model)
        except Exception as e: logger.warning("[ChatStream %s] user message save failed (non-fatal): %s", self.conn_id, e)

        messages = [{"role": "user", "content": content}]
        try:
            await asyncio.wait_for(
                self._stream_and_save_response(provider, messages, model, params, conv, provider_name),
                timeout=self.max_stream_seconds
            )
        except asyncio.TimeoutError:
            await self._send_error("Streaming timed out.", "timeout")
        except asyncio.CancelledError:
            logger.info("[ChatStream %s] streaming task was cancelled.", self.conn_id)
            await self._send_error("Request was cancelled.", "cancelled")

    async def _stream_and_save_response(self, provider, messages, model: str, params: Dict[str, Any], conv: Optional[Conversation], provider_name: Optional[str]):
        buffer_parts: list[str] = []
        await self.send_json({"type": "started"})
        t0 = asyncio.get_running_loop().time()
        gen = None
        try:
            gen = await asyncio.to_thread(provider.generate, messages=messages, model=model, params=params, stream=True)
            while True:
                try: event = await asyncio.to_thread(next, gen)
                except StopIteration: break
                except RuntimeError as e:
                    if "StopIteration interacts badly with generators" in str(e): break
                    raise
                if not isinstance(event, dict) or "type" not in event: await self._send_error("Malformed event from provider.", error_type="event_format"); return
                if event["type"] == "token":
                    delta = event.get("delta") or ""
                    buffer_parts.append(str(delta)); event["delta"] = str(delta)
                await self.send_json(event)
            final_text = "".join(buffer_parts)
            latency_ms = int((asyncio.get_running_loop().time() - t0) * 1000)
            if conv is not None:
                try:
                    await self._create_assistant_message(conv, final_text, provider_name, model, latency_ms)
                    try: generate_and_save_smart_title_task.delay(conv.id)
                    except Exception as e: logger.warning("[ChatStream %s] could not queue smart title: %s", self.conn_id, e)
                except Exception as e: logger.warning("[ChatStream %s] assistant message save failed: %s", self.conn_id, e)
            await self.send_json({"type": "done", "finish_reason": "completed"})
        finally:
            try:
                if gen and hasattr(gen, "close"): await asyncio.to_thread(gen.close)
            except Exception as e: logger.debug("[ChatStream %s] generator.close() ignored: %s", self.conn_id, e)