from django.urls import path
from .views import (
    MessageCreateView, MessageCreateStreamView,
    ConversationListView, ConversationMessagesView,
)
urlpatterns = [
    path("messages", MessageCreateView.as_view(), name="message-create"),
    path("messages/stream", MessageCreateStreamView.as_view(), name="message-stream"), # استریمی (جدید)
path("conversations", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:conversation_id>/messages",
         ConversationMessagesView.as_view(), name="conversation-messages"),
]
