from django.contrib import admin
from .models import Conversation, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "title", "created_at", "updated_at")
    search_fields = ("title", "owner__username")

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "role", "status", "created_at")
    list_filter = ("role", "status")
    search_fields = ("content",)
