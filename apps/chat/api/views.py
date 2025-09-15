from typing import List
import logging

from django.conf import settings
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.generics import ListAPIView
from rest_framework import status
from rest_framework.authentication import SessionAuthentication

from apps.chat.models import Conversation, Message
from .serializers import (
    MessageCreateSerializer,
    MessageSerializer,
    ConversationSerializer,
)
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from apps.gateway.service import get_provider
from apps.queueapp.tasks import run_generation_task  # ✨ وارد کردن وظیفه Celery

log = logging.getLogger(__name__)


# ---------------------------
# Helpers (session + access)
# ---------------------------

def _session_ids(request) -> List[int]:
    """آیدی گفت‌وگوهای مهمان که در سشن ذخیره شده‌اند (لیست امن)."""
    ids = request.session.get("guest_conversations", [])
    return ids if isinstance(ids, list) else []


def _add_session_conv(request, conv_id: int) -> None:
    """افزودن conv جدید مهمان به سشن."""
    ids = _session_ids(request)
    if conv_id not in ids:
        ids.append(conv_id)
        request.session["guest_conversations"] = ids
        request.session.modified = True


def _accessible_conversations(request):
    """
    مجموعه‌ی گفتگوهایی که کاربر فعلی به آن‌ها دسترسی دارد:
      - اگر لاگین: owner == user  یا  (owner is null و conv در سشن مهمان باشد)
      - اگر مهمان: owner is null و conv در سشن مهمان باشد
    """
    sess_ids = _session_ids(request)
    if request.user.is_authenticated:
        return Conversation.objects.filter(
            Q(owner=request.user) | Q(owner__isnull=True, id__in=sess_ids)
        )
    else:
        return Conversation.objects.filter(owner__isnull=True, id__in=sess_ids)


def _ensure_access_or_404(request, conv: Conversation) -> None:
    """
    کنترل دسترسی برای یک گفتگو (در مسیرهایی که conv قبلاً گرفته شده).
    - کاربر لاگین: یا owner خودش باشد، یا conv بی‌مالک و در سشن باشد.
    - مهمان: conv باید در سشن باشد.
    """
    user = request.user if request.user.is_authenticated else None
    sess_ids = _session_ids(request)

    if user:
        allowed = (conv.owner_id == user.id) or (conv.owner_id is None and conv.id in sess_ids)
    else:
        allowed = (conv.owner_id is None) and (conv.id in sess_ids)

    if not allowed:
        raise Http404


# ---------------------------
# Message Create (sync) - (بدون تغییر)
# ---------------------------

class MessageCreateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]

    def post(self, request):
        ser = MessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        max_len = getattr(settings, "MAX_PROMPT_CHARS", 4000)
        if len(data["content"]) > max_len:
            return Response(
                {"detail": f"Message too long (>{max_len} chars)."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        if data.get("conversation_id"):
            conv = get_object_or_404(Conversation, id=data["conversation_id"])
            _ensure_access_or_404(request, conv)
            if request.user.is_authenticated and conv.owner_id is None:
                conv.owner = request.user
                conv.save(update_fields=["owner"])
        else:
            conv = Conversation.objects.create(
                owner=request.user if request.user.is_authenticated else None,
                title="",
            )
            if not request.user.is_authenticated:
                _add_session_conv(request, conv.id)

        user_msg = Message.objects.create(
            conversation=conv,
            role=Message.Role.USER,
            content=data["content"],
            status=Message.Status.WORKING,
            provider=(data.get("provider") or "").strip() or None,
            model_name=(data.get("model") or "").strip() or None,
        )

        provider = get_provider(user_msg.provider)
        events = provider.generate(
            messages=[{"role": "user", "content": data["content"]}],
            model=user_msg.model_name,
            stream=True,
        )

        response_text = ""
        for ev in events:
            if ev.get("type") == "token":
                response_text += ev.get("delta", "")

        Message.objects.create(
            conversation=conv,
            role=Message.Role.ASSISTANT,
            content=response_text,
            status=Message.Status.DONE,
            provider=getattr(provider, "name", "unknown"),
            model_name=user_msg.model_name or getattr(provider, "default_model", None),
        )
        user_msg.status = Message.Status.DONE
        user_msg.save(update_fields=["status"])

        return Response(
            {"conversation_id": conv.id, "message_id": user_msg.id, "response": response_text},
            status=status.HTTP_201_CREATED,
        )


# ---------------------------
# Message Create (stream init) - (✨ بخش اصلی تغییرات)
# ---------------------------

class MessageCreateStreamView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]

    def post(self, request):
        ser = MessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        max_len = getattr(settings, "MAX_PROMPT_CHARS", 4000)
        if len(data["content"]) > max_len:
            return Response(
                {"detail": f"Message too long (>{max_len} chars)."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        new_conv_created = False
        if data.get("conversation_id"):
            conv = get_object_or_404(Conversation, id=data["conversation_id"])
            _ensure_access_or_404(request, conv)
            if request.user.is_authenticated and conv.owner_id is None:
                conv.owner = request.user
                conv.save(update_fields=["owner"])
        else:
            owner = request.user if request.user.is_authenticated else None
            conv = Conversation.objects.create(owner=owner, title="")
            new_conv_created = True
            log.debug(f"✅ New conversation created with ID: {conv.id} for owner: {owner}")
            if not request.user.is_authenticated:
                _add_session_conv(request, conv.id)

        user_msg = Message.objects.create(
            conversation=conv,
            role=Message.Role.USER,
            content=data["content"],
            status=Message.Status.QUEUED,
            provider=(data.get("provider") or "").strip() or None,
            model_name=(data.get("model") or "").strip() or None,
        )
        log.debug(f"✅ New message created with ID: {user_msg.id} in conversation: {conv.id}")
        
        run_generation_task.delay(user_msg.id)

        response_data = {
            "conversation_id": conv.id,
            "message_id": user_msg.id,
            "ws_path": f"/ws/messages/{user_msg.id}/stream/",
        }

        if new_conv_created:
            response_data['new_conversation'] = ConversationSerializer(conv).data

        return Response(response_data, status=status.HTTP_201_CREATED)


# ---------------------------
# Conversations list - (بدون تغییر)
# ---------------------------

class ConversationListView(ListAPIView):
    # ... (بدون تغییر)
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return _accessible_conversations(self.request).order_by("-updated_at")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        ids = list(qs.values_list("id", flat=True))
        log.info("CONV_LIST", extra={
            "user_id": getattr(request.user, "id", None),
            "sess_ids": request.session.get("guest_conversations", []),
            "returned_ids": ids,
        })
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

# ---------------------------
# Messages of one conversation - (بدون تغییر)
# ---------------------------

class ConversationMessagesView(ListAPIView):
    # ... (بدون تغییر)
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    serializer_class = MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        conv = get_object_or_404(_accessible_conversations(self.request), pk=conversation_id)
        return Message.objects.filter(conversation=conv).order_by("id")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        count = qs.count()
        log.info("CONV_MSGS", extra={
            "user_id": getattr(request.user, "id", None),
            "pk": self.kwargs.get("conversation_id"),
            "count": count,
        })
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

# ---------------------------
# Authentication Status - (بدون تغییر)
# ---------------------------

@require_http_methods(["GET"])
@csrf_exempt
def auth_status(request):
    # ... (بدون تغییر)
    if request.user.is_authenticated:
        user_data = {
            'id': request.user.id,
            'email': request.user.email,
            'first_name': request.user.first_name or '',
            'last_name': request.user.last_name or '',
        }
        if hasattr(request.user, 'avatar_url'): user_data['avatar_url'] = request.user.avatar_url or ''
        if hasattr(request.user, 'phone_number'): user_data['phone_number'] = request.user.phone_number or ''
        if hasattr(request.user, 'default_provider'): user_data['default_provider'] = request.user.default_provider or ''
        if hasattr(request.user, 'default_model'): user_data['default_model'] = request.user.default_model or ''
        log.info("AUTH_STATUS_CHECK", extra={"user_id": request.user.id, "email": request.user.email, "authenticated": True})
        return JsonResponse({'authenticated': True, 'user': user_data})
    else:
        session_convs = _session_ids(request)
        log.info("AUTH_STATUS_CHECK", extra={"authenticated": False, "guest_conversations": len(session_convs)})
        return JsonResponse({'authenticated': False, 'user': None, 'guest_conversations_count': len(session_convs)})