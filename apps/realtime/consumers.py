from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser

from apps.chat.models import Message
from apps.queueapp.tasks import run_generation_task
from apps.chat.session_utils import session_is_allowed

class EchoConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send_json({"type": "welcome"})

    async def receive_json(self, content, **kwargs):
        await self.send_json({"echo": content})


class MessageStreamConsumer(AsyncJsonWebsocketConsumer):
    """
    تنها به صاحب گفتگو اجازه اتصال به استریم می‌دهد:
      - اگر کاربر لاگین است: conv.owner == request.user
      - اگر مهمان است: conv_id باید در سشن guest_conversations باشد.
    """

    async def connect(self):
        # 1) گرفتن message_id از URL
        try:
            self.message_id = int(self.scope["url_route"]["kwargs"]["message_id"])
        except Exception:
            await self.close(code=4400)  # bad request
            return

        # 2) لود پیام + گفتگو
        try:
            msg = await sync_to_async(
                lambda: Message.objects.select_related("conversation").get(id=self.message_id)
            )()
        except Message.DoesNotExist:
            await self.accept()
            await self.send_json({"type": "error", "error": "message_not_found"})
            await self.close(code=4404)  # not found
            return

        conv = msg.conversation

        # 3) احراز دسترسی
        user = self.scope.get("user")
        is_auth = bool(user and not isinstance(user, AnonymousUser) and user.is_authenticated)

        if is_auth:
            # اگر گفتگو مالک دارد و مالک شخص دیگری است → ممنوع
            if conv.owner_id and conv.owner_id != user.id:
                await self.accept()
                await self.send_json({"type": "error", "error": "forbidden"})
                await self.close(code=4403)
                return
            # اگر conv بی‌مالک است، اجازه اتصال می‌دهیم (API قبلاً مالک را claim می‌کند)
        else:
            # مهمان: conv باید قبلاً در سشن ثبت شده باشد
            session = self.scope.get("session")
            conv_ok = session_is_allowed(session, conv.id) if session else False
            if not conv_ok:
                await self.accept()
                await self.send_json({"type": "error", "error": "forbidden"})
                await self.close(code=4403)
                return

        # 4) اگر اجازه دارد: به گروه بپیوندد و ادامه
        self.group = f"msg_{self.message_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        await self.send_json({"type": "queued", "message_id": self.message_id})

        # 5) تریگر سلری (در prod واقعاً روی ورکر اجرا می‌شود)
        run_generation_task.delay(self.message_id)

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def stream_message(self, event):
        await self.send_json(event["event"])
