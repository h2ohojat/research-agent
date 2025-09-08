from django.urls import re_path
from .consumers import EchoConsumer, MessageStreamConsumer

websocket_urlpatterns = [
    re_path(r"^ws/echo/$", EchoConsumer.as_asgi()),
    re_path(r"^ws/messages/(?P<message_id>\d+)/stream/$", MessageStreamConsumer.as_asgi()),
]
