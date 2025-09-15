from django.urls import path , include
from .views import (
    MessageCreateView, 
    MessageCreateStreamView,
    ConversationListView, 
    ConversationMessagesView,
    auth_status,
)

# نام اپ برای جلوگیری از تداخل در آینده (توصیه شده)
app_name = "chat_api"

urlpatterns = [
    # --- آدرس‌های مربوط به مکالمات و پیام‌ها ---
    
    # ✨ FIX: URL from 'messages/stream' to 'messages/stream/' (added trailing slash)
    # این آدرس اکنون با درخواست فرانت‌اند (`/api/v1/messages/stream/`) مطابقت دارد
    path("messages/stream/", MessageCreateStreamView.as_view(), name="message-stream"),
    
    # ✨ FIX: URL from 'conversations/<int:conversation_id>/messages' to 'conversations/<int:conversation_id>/messages/'
    path("conversations/<int:conversation_id>/messages/", ConversationMessagesView.as_view(), name="conversation-messages"),

    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("messages/", MessageCreateView.as_view(), name="message-create"), # 'messages' should have a trailing slash too

    # --- آدرس‌های متفرقه (مانند احراز هویت) ---
    
    # ✅ این آدرس صحیح است و نیازی به تغییر ندارد
    path("auth/status/", auth_status, name="auth-status"),

    # ❌ حذف شد: این خط باعث تداخل آدرس و خطای 'namespace' می‌شد
    path('', include('apps.models.urls')),
]