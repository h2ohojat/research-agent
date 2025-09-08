# pyamooz_ai/asgi.py
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from django.urls import path

from apps.realtime.routing import websocket_urlpatterns  # باید الگوهای ws را از اینجا import کنی

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pyamooz_ai.settings.dev")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
