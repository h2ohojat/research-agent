# pyamooz_ai/asgi.py

import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack  # ✨ 1. جایگزین SessionMiddlewareStack شد
from django.core.asgi import get_asgi_application

# تنظیم متغیر محیطی برای تنظیمات جنگو
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pyamooz_ai.settings.dev")

# این خط برای اطمینان از بارگذاری کامل برنامه‌های جنگو قبل از هر کار دیگری ضروری است
django.setup()

# حالا که جنگو آماده است، می‌توانیم ماژول‌های وابسته به آن را import کنیم
from apps.realtime.routing import websocket_urlpatterns

# برنامه اصلی برای درخواست‌های HTTP
django_asgi_app = get_asgi_application()

# تعریف پروتکل‌ها
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    
    # برای اتصالات WebSocket، از میان‌افزار احراز هویت استفاده می‌کنیم
    "websocket": AuthMiddlewareStack(  # ✨ 2. استفاده از میان‌افزار صحیح
        URLRouter(
            websocket_urlpatterns
        )
    ),
})