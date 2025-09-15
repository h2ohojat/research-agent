# pyamooz_ai/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator

# ✅ محیط باید صراحتاً ست شده باشد؛ در غیر اینصورت خطا بده
if not os.getenv("DJANGO_SETTINGS_MODULE"):
    raise RuntimeError(
        "DJANGO_SETTINGS_MODULE تعریف نشده است. "
        "در محیط توسعه: pyamooz_ai.settings.dev "
        "و در محیط تولید: pyamooz_ai.settings.prod را ست کنید."
    )

django_asgi_app = get_asgi_application()

# پس از init جنگو الگوهای ws را import کن
from apps.realtime.routing import websocket_urlpatterns  # noqa: E402


def _norm_origin(s: str) -> str:
    return s.strip().rstrip("/")


# 🎯 اوریجین‌های مجاز برای WebSocket
# 1) از WS_ALLOWED_ORIGINS (لیست با کاما)
ws_allowed = [_norm_origin(x) for x in os.getenv("WS_ALLOWED_ORIGINS", "").split(",") if x.strip()]

# 2) از CSRF_TRUSTED_ORIGINS اگر در prod.py تنظیم شده
csrf_origins = [_norm_origin(x) for x in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if x.strip()]
ws_allowed.extend(csrf_origins)

# 3) اگر هنوز خالی بود، از ALLOWED_HOSTS فهرست https://host را بساز (fallback معقول)
if not ws_allowed:
    hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip() and h.strip() != "*"]
    ws_allowed = [f"https://{h}" for h in hosts]

# یکتا و مرتب
ws_allowed = sorted(set(ws_allowed))

# لایهٔ ws با احراز هویت سشن
ws_app = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))

# بستن بر اساس Origin (scheme + host لازم است)
if ws_allowed:
    ws_app = OriginValidator(ws_app, ws_allowed)

# و بستن بر اساس Host header (ALLOWED_HOSTS)
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(ws_app),
})
