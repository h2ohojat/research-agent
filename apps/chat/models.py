# apps/chat/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone

class Conversation(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="conversations",
        help_text="مالک گفتگو (در صورت ورود). برای مهمان‌ها خالی می‌ماند."
    )
    title = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self):
        return self.title or f"Conversation #{self.pk}"

class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        WORKING = "working", "Working"
        STREAMING = "streaming", "Streaming"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DONE)

    # تلمتری/متادیتا
    provider = models.CharField(max_length=64, blank=True, null=True)
    model_name = models.CharField(max_length=128, blank=True, null=True)
    tokens_input = models.IntegerField(blank=True, null=True)
    tokens_output = models.IntegerField(blank=True, null=True)
    latency_ms = models.IntegerField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.role}: {self.content[:30]}"
