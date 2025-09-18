# apps/realtime/consumers.py
import json
import logging
import asyncio
import re
import uuid
import time
from typing import Any, Dict, Optional, Iterable

from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.conf import settings as django_settings
from django.db import transaction
from django.core.exceptions import FieldDoesNotExist

from apps.gateway.service import get_provider
from apps.chat.models import Conversation, Message
from apps.chat.tasks import generate_and_save_smart_title_task
from apps.chat.services import _make_quick_title

logger = logging.getLogger(__name__)

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
# ... (کلاس‌های EchoConsumer و MessageStreamConsumer بدون تغییر باقی می‌مانند) ...
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
# ChatStreamConsumer (نسخه نهایی و ۱۰۰٪ صحیح)
# ======================================================================

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
        self.inbox: Optional[asyncio.Queue] = None
        self.runner_task: Optional[asyncio.Task] = None
        self.current_stream_task: Optional[asyncio.Task] = None
        self.max_stream_seconds = getattr(django_settings, "REALTIME_MAX_SECONDS", 120)
        self.message_counter = 0
        self.user = None  # ✨ تغییر ۱: تعریف متغیر برای نگهداری کاربر
        logger.info(f"[ChatStream {self.conn_id}] Consumer initialized with timeout={self.max_stream_seconds}s")

    # ---------- ORM helpers ----------
    @sync_to_async
    def _create_conversation(self, user, model: Optional[str], initial_content: str = "") -> Optional[Conversation]: # ✨ تغییر ۲: افزودن 'user' به عنوان آرگومان
        """ایجاد گفتگو جدید به صورت اتمیک با عنوان سریع و مالک صحیح"""
        start_time = time.monotonic()
        owner = user if getattr(user, "is_authenticated", False) else None
        
        quick_title = _make_quick_title(initial_content) if initial_content else ""
        
        kwargs = {"title": quick_title}
        if owner:
            kwargs["owner"] = owner

        for fname in ("model_name", "model", "llm_model", "model_key", "model_slug"):
            if _has_field(Conversation, fname): kwargs[fname] = (model or ""); break
        try:
            with transaction.atomic():
                conv = Conversation.objects.create(**kwargs)
            elapsed = time.monotonic() - start_time
            logger.info(f"[ChatStream {self.conn_id}] Conversation created atomically id={conv.id} title='{conv.title}' owner={getattr(owner, 'id', None)} in {elapsed:.3f}s")
            return conv
        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.warning(f"[ChatStream {self.conn_id}] Could not create Conversation in {elapsed:.3f}s. Error: {e}")
            return None

    # ... (بقیه متدهای ORM helper بدون تغییر باقی می‌مانند) ...
    @sync_to_async
    def _get_conversation(self, conv_id: int) -> Conversation:
        start_time = time.monotonic()
        try:
            conv = Conversation.objects.get(id=conv_id)
            elapsed = time.monotonic() - start_time
            logger.info(f"[ChatStream {self.conn_id}] Retrieved conversation id={conv_id} title='{conv.title}' in {elapsed:.3f}s")
            return conv
        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.error(f"[ChatStream {self.conn_id}] Failed to get conversation id={conv_id} in {elapsed:.3f}s. Error: {e}")
            raise

    @sync_to_async
    def _create_user_message(self, conv: Conversation, content: str, provider: Optional[str], model: Optional[str]) -> Optional[Message]:
        if conv is None: return None
        start_time = time.monotonic()
        kwargs = {"conversation": conv}
        if _has_field(Message, "role"): kwargs["role"] = _enum_member(Message, "Role", "USER", "user")
        if _has_field(Message, "content"): kwargs["content"] = content
        if _has_field(Message, "status"): kwargs["status"] = _enum_member(Message, "Status", "DONE", "done")
        for fname, val in [("provider", provider), ("provider_name", provider), ("model_name", model), ("model", model), ("llm_model", model)]:
            if _has_field(Message, fname): kwargs[fname] = (val or "")
        for fname, val in [("tokens_input", len(content)), ("input_tokens", len(content))]:
            if _has_field(Message, fname): kwargs[fname] = val
        try:
            with transaction.atomic():
                msg = Message.objects.create(**kwargs)
            elapsed = time.monotonic() - start_time
            logger.info(f"[ChatStream {self.conn_id}] User message saved atomically id={getattr(msg, 'id', None)} conv={getattr(conv, 'id', None)} in {elapsed:.3f}s")
            return msg
        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.warning(f"[ChatStream {self.conn_id}] Could not save user message in {elapsed:.3f}s. Error: {e}")
            return None

    @sync_to_async
    def _create_assistant_message(self, conv: Conversation, text: str, provider: Optional[str], model: Optional[str], latency_ms: int) -> Optional[Message]:
        if conv is None: return None
        start_time = time.monotonic()
        kwargs = {"conversation": conv}
        if _has_field(Message, "role"): kwargs["role"] = _enum_member(Message, "Role", "ASSISTANT", "assistant")
        if _has_field(Message, "content"): kwargs["content"] = text
        if _has_field(Message, "status"): kwargs["status"] = _enum_member(Message, "Status", "DONE", "done")
        for fname, val in [("provider", provider), ("provider_name", provider), ("model_name", model), ("model", model), ("llm_model", model)]:
            if _has_field(Message, fname): kwargs[fname] = (val or "")
        for fname, val in [("tokens_output", len(text)), ("output_tokens", len(text)), ("latency_ms", latency_ms), ("latency", latency_ms)]:
            if _has_field(Message, fname): kwargs[fname] = val
        try:
            with transaction.atomic():
                msg = Message.objects.create(**kwargs)
            elapsed = time.monotonic() - start_time
            logger.info(f"[ChatStream {self.conn_id}] Assistant message saved atomically id={getattr(msg, 'id', None)} conv={getattr(conv, 'id', None)} text_len={len(text)} in {elapsed:.3f}s")
            return msg
        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.warning(f"[ChatStream {self.conn_id}] Could not save assistant message in {elapsed:.3f}s. Error: {e}")
            return None
            
    # ---------- Lifecycle ----------
    async def connect(self):
        self.user = self.scope.get("user")  # ✨ تغییر ۱: ذخیره کاربر در متغیر کلاس هنگام اتصال
        logger.info(f"DEBUG_AUTH: User object from scope: {repr(self.user)}")
        logger.info(f"DEBUG_AUTH: Is user authenticated? {getattr(self.user, 'is_authenticated', False)}")
        await self.accept()
        self.inbox = asyncio.Queue()
        self.runner_task = asyncio.create_task(self._runner())
        await self.send_json({"type": "connected"})
        if self.user and self.user.is_authenticated:
            logger.info(f"[ChatStream {self.conn_id}] Authenticated user connected: {getattr(self.user, 'email', self.user.username)}. Client: {self.scope.get('client')}")
        else:
            logger.info(f"[ChatStream {self.conn_id}] Anonymous user connected. Client: {self.scope.get('client')}")

    # ... (متدهای disconnect, receive, _runner بدون تغییر باقی می‌مانند) ...
    async def disconnect(self, code):
        logger.info(f"[ChatStream {self.conn_id}] Disconnect called (code={code}). Processed {self.message_counter} messages.")
        runner_status = "done" if self.runner_task and self.runner_task.done() else "running"
        stream_status = "done" if self.current_stream_task and self.current_stream_task.done() else "running"
        logger.info(f"[ChatStream {self.conn_id}] Tasks status before cancel: runner={runner_status}, stream={stream_status}")
        if self.runner_task and not self.runner_task.done(): self.runner_task.cancel()
        if self.current_stream_task and not self.current_stream_task.done(): self.current_stream_task.cancel()
        logger.info(f"[ChatStream {self.conn_id}] Disconnected. All tasks cancelled.")

    async def receive(self, text_data=None, bytes_data=None):
        receive_time = time.monotonic()
        try: data = json.loads(text_data or "{}")
        except Exception as e:
            logger.error(f"[ChatStream {self.conn_id}] Bad JSON payload: {e}")
            await self._send_error(f"Bad JSON payload: {e}", error_type="bad_payload")
            return
        msg_type = data.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            logger.debug(f"[ChatStream {self.conn_id}] Ping-pong")
            return
        if msg_type == "cancel":
            if self.current_stream_task and not self.current_stream_task.done():
                self.current_stream_task.cancel()
                logger.info(f"[ChatStream {self.conn_id}] Client requested stream cancellation.")
            return
        if msg_type != "chat_message":
            logger.warning(f"[ChatStream {self.conn_id}] Unknown message type: {msg_type}")
            await self._send_error(f"Unknown message type: {msg_type}", error_type="unknown_type")
            return
        self.message_counter += 1
        req_id = f"msg-{self.message_counter:03d}"
        data['req_id'] = req_id
        data['receive_time'] = receive_time
        queue_size = self.inbox.qsize()
        logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Received chat message. Queue size: {queue_size}")
        await self.inbox.put(data)
        logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Message enqueued successfully.")

    async def _runner(self):
        logger.info(f"[ChatStream {self.conn_id}] Runner task started.")
        try:
            while True:
                logger.debug(f"[ChatStream {self.conn_id}] Runner waiting for next message...")
                data = await self.inbox.get()
                req_id = data.get('req_id', 'no-id')
                receive_time = data.get('receive_time', time.monotonic())
                dequeue_time = time.monotonic()
                queue_wait = dequeue_time - receive_time
                logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Message dequeued after {queue_wait:.3f}s wait. Starting handler...")
                self.current_stream_task = asyncio.create_task(self._handle_chat_message(data))
                try:
                    await self.current_stream_task
                    handler_time = time.monotonic() - dequeue_time
                    logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Handler completed successfully in {handler_time:.3f}s.")
                except Exception as e:
                    handler_time = time.monotonic() - dequeue_time
                    logger.exception(f"[ChatStream {self.conn_id}] [{req_id}] Handler failed after {handler_time:.3f}s: {e}")
                finally:
                    self.current_stream_task = None
                    self.inbox.task_done()
                    total_time = time.monotonic() - receive_time
                    logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Total processing time: {total_time:.3f}s. Runner ready for next message.")
        except asyncio.CancelledError:
            logger.info(f"[ChatStream {self.conn_id}] Runner task is shutting down.")
        except Exception:
            logger.exception(f"[ChatStream {self.conn_id}] Unhandled exception in runner task.")
            
    # ---------- Handler ----------
    async def _handle_chat_message(self, data: Dict[str, Any]):
        # ... (بخش اولیه هندلر بدون تغییر باقی می‌ماند) ...
        req_id = data.get('req_id', 'no-id')
        handler_start = time.monotonic()
        content = (data.get("content") or "").strip()
        model, params, provider_name, conversation_id = data.get("model"), data.get("params", {}), data.get("provider"), data.get("conversation_id")
        logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Processing: model={model}, provider={provider_name}, conv_id={conversation_id}, content_len={len(content)}")
        
        if not content:
            await self._send_error("Empty content.", error_type="input_validation")
            return
        if not model or not isinstance(model, str):
            await self._send_error("No model selected.", error_type="input_validation")
            return

        try:
            provider = await sync_to_async(get_provider)(provider_name)
        except Exception as e:
            await self._send_error(f"Provider init failed: {e}", error_type="provider_init")
            return
            
        conv: Optional[Conversation] = None
        if conversation_id:
            try:
                conv = await self._get_conversation(int(conversation_id))
            except Exception as e:
                await self._send_error("Conversation not found.", error_type="not_found")
                return
            await self._create_user_message(conv, content, provider_name, model)
        else:
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Creating new conversation...")
            
            # ✨ تغییر ۳: پاس دادن 'self.user' به تابع ساخت گفتگو
            conv = await self._create_conversation(user=self.user, model=model, initial_content=content)
            
            if conv is None:
                await self._send_error("Failed to create conversation.", error_type="db_error")
                return
            
            user_message = await self._create_user_message(conv, content, provider_name, model)
            if user_message is None:
                await self._send_error("Failed to save initial message.", error_type="db_error")
                return

            await self.send_json({
                "type": "ConversationCreated",
                "conversation_id": conv.id,
                "title": conv.title
            })
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] New conversation id={conv.id} title='{conv.title}' and first message saved atomically. Notified client.")

        # ... (بقیه هندلر و متد _stream_and_save_response بدون تغییر باقی می‌ماند) ...
        messages = [{"role": "user", "content": content}]
        try:
            await asyncio.wait_for(
                self._stream_and_save_response(provider, messages, model, params, conv, provider_name, req_id),
                timeout=self.max_stream_seconds
            )
        except asyncio.TimeoutError:
            await self._send_error("Streaming timed out.", "timeout")
        except asyncio.CancelledError:
            await self._send_error("Request was cancelled.", "cancelled")
            
    async def _stream_and_save_response(self, provider, messages, model: str, params: Dict[str, Any], conv: Optional[Conversation], provider_name: Optional[str], req_id: str):
        buffer_parts: list[str] = []
        await self.send_json({"type": "started"})
        stream_start = time.monotonic()
        gen = None
        token_count = 0
        try:
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Initializing provider stream...")
            gen_start = time.monotonic()
            gen = await asyncio.to_thread(provider.generate, messages=messages, model=model, params=params, stream=True)
            gen_init_time = time.monotonic() - gen_start
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Provider stream initialized in {gen_init_time:.3f}s")
            first_token_time = None
            while True:
                try:
                    event = await asyncio.to_thread(next, gen)
                    if first_token_time is None:
                        first_token_time = time.monotonic()
                        ttft = first_token_time - stream_start
                        logger.info(f"[ChatStream {self.conn_id}] [{req_id}] First token received in {ttft:.3f}s")
                except StopIteration: break
                except RuntimeError as e:
                    if "StopIteration interacts badly with generators" in str(e): break
                    raise
                if not isinstance(event, dict) or "type" not in event:
                    logger.error(f"[ChatStream {self.conn_id}] [{req_id}] Malformed event from provider: {event}")
                    await self._send_error("Malformed event from provider.", error_type="event_format")
                    return
                if event["type"] == "token":
                    delta = event.get("delta") or ""
                    buffer_parts.append(str(delta))
                    event["delta"] = str(delta)
                    token_count += 1
                await self.send_json(event)
            stream_end = time.monotonic()
            stream_duration = stream_end - stream_start
            final_text = "".join(buffer_parts)
            latency_ms = int(stream_duration * 1000)
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Stream finished: {token_count} tokens, {len(final_text)} chars in {stream_duration:.3f}s")
            if conv is not None:
                save_start = time.monotonic()
                try:
                    await self._create_assistant_message(conv, final_text, provider_name, model, latency_ms)
                    save_time = time.monotonic() - save_start
                    logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Assistant message saved in {save_time:.3f}s")
                    celery_start = time.monotonic()
                    try:
                        generate_and_save_smart_title_task.delay(conv.id)
                        celery_time = time.monotonic() - celery_start
                        logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Celery task queued in {celery_time:.3f}s")
                    except Exception as e:
                        celery_time = time.monotonic() - celery_start
                        logger.warning(f"[ChatStream {self.conn_id}] [{req_id}] Could not queue smart title in {celery_time:.3f}s: {e}")
                except Exception as e:
                    save_time = time.monotonic() - save_start
                    logger.warning(f"[ChatStream {self.conn_id}] [{req_id}] Assistant message save failed in {save_time:.3f}s: {e}")
            await self.send_json({"type": "done", "finish_reason": "completed"})
            logger.info(f"[ChatStream {self.conn_id}] [{req_id}] Response completed and sent to client.")
        finally:
            close_start = time.monotonic()
            try:
                if gen and hasattr(gen, "close"):
                    await asyncio.to_thread(gen.close)
                    close_time = time.monotonic() - close_start
                    logger.debug(f"[ChatStream {self.conn_id}] [{req_id}] Generator closed in {close_time:.3f}s")
            except Exception as e:
                close_time = time.monotonic() - close_start
                logger.debug(f"[ChatStream {self.conn_id}] [{req_id}] Generator close ignored in {close_time:.3f}s: {e}")