from .base import *  # noqa
import os

# ---------------------------
# Core
# ---------------------------
DEBUG = False

# از env بخوان؛ در پروڈاکشن نباید پیش‌فرض باز داشته باشیم
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
SECRET_KEY = os.getenv("SECRET_KEY", "")

if not SECRET_KEY or SECRET_KEY == "dev-secret":
    raise RuntimeError("SECRET_KEY در پروڈکشن تنظیم نشده یا مقدار ناامن دارد.")

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ["*"]:
    raise RuntimeError("ALLOWED_HOSTS در پروڈاکشن باید به دامنه/ها محدود شود.")

# اگر از پروکسی/لودبالنسر HTTPS استفاده می‌کنی (مثل Caddy/Nginx):
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---------------------------
# HTTPS Security
# ---------------------------
SECURE_SSL_REDIRECT = True                # همه‌ی HTTP → HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# HSTS (بعد از اطمینان از HTTPS پایدار فعال کن)
SECURE_HSTS_SECONDS = 31536000            # 1 سال
SECURE_HSTS_INCLUDE_SUBDOMAINS = False    # اگر همه ساب‌دامین‌ها HTTPS هستند True کن
SECURE_HSTS_PRELOAD = False

# سیاست ارجاع‌دهنده
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# ---------------------------
# CSRF Trusted Origins
# ---------------------------
# در Django 4+ باید scheme هم باشد: مثل https://example.com
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
if not CSRF_TRUSTED_ORIGINS:
    # اگر چیزی در env ندادی، براساس ALLOWED_HOSTS بساز (فقط برای host های صریح، نه *)
    CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h and h != "*"]

# ---------------------------
# Static / Media (پروڈاکشن)
# ---------------------------
# اگر CDN نداری و می‌خواهی از WhiteNoise استفاده کنی:
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# (در base.py قبلاً STATIC_URL/ROOT تعریف شده؛ اگر Media هم داری آنجا تعریف کن)
# MEDIA_URL = "/media/"
# MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------
# Django REST Framework (سخت‌گیرتر)
# ---------------------------
REST_FRAMEWORK.update({
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
})

# ---------------------------
# allauth
# ---------------------------
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"

# ---------------------------
# Logging
# ---------------------------
# لاگ JSON در base تنظیم شده؛ در صورت نیاز سطح لاگ اپ‌های پرصدا را اینجا کم/زیاد کن.
# LOGGING["loggers"] = {
#     "apps.gateway": {"level": "INFO"},
#     "apps.chat": {"level": "INFO"},
# }
