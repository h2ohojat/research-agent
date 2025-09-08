from rest_framework import serializers
from apps.chat.models import Conversation, Message

class MessageCreateSerializer(serializers.Serializer):
    conversation_id = serializers.IntegerField(required=False)
    content = serializers.CharField(max_length=4000)
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "title", "created_at", "updated_at")

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = (
            "id", "conversation", "role", "content", "status", "created_at",
            "tokens_input", "tokens_output", "latency_ms", "provider", "model_name",
        )
