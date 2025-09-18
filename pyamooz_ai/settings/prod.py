# pyamooz_ai/settings/prod.py
from .base import *  # noqa
import os
import dj_database_url

# -------- تنظیمات هسته برای محیط پروداکشن --------
# این تنظیمات، مقادیر پایه را برای اجرا روی سرور واقعی، امن و بهینه می‌کنند.

# حالت دیباگ در پروداکشن باید همیشه و مطلقاً خاموش باشد.
DEBUG = False

# کلید امنیتی باید از متغیرهای محیطی خوانده شود. در غیر این صورت برنامه اجرا نخواهد شد.
SECRET_KEY = os.environ['SECRET_KEY']

# دامنه‌هایی که به برنامه شما سرویس می‌دهند. این متغیر باید در پنل لیارا تنظیم شود.
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# -------- امنیت --------
# تنظیمات امنیتی قوی برای ارتباطات تحت HTTPS

# ریدایرکت تمام درخواست‌های HTTP به HTTPS
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# استفاده از کوکی‌های امن
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# تنظیمات پیشرفته امنیتی (HSTS) برای محافظت در برابر حملات Man-in-the-Middle
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", 31536000))  # 1 سال
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# محافظت‌های دیگر
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# دامنه‌هایی که برای درخواست‌های CSRF امن شناخته می‌شوند.
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')

# -------- پایگاه داده (اتصال به PostgreSQL لیارا) --------
# از متغیر DATABASE_URL که توسط لیارا فراهم می‌شود، برای تمام تنظیمات استفاده می‌کنیم.
# این روش استاندارد و بسیار مطمئن است.
DATABASES = {
    'default': dj_database_url.config(
        conn_max_age=600,  # برای حفظ اتصالات پایدار
        ssl_require=False  # در شبکه خصوصی لیارا نیازی به SSL نیست
    )
}

# -------- فایل‌های استاتیک (سرو با WhiteNoise) --------
# WhiteNoise بهترین و ساده‌ترین راه برای سرو فایل‌های استاتیک در لیارا است.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

# -------- Celery / Channels / Redis (اتصال به Redis لیارا) --------
# آدرس سرور Redis از متغیر محیطی REDIS_URL خوانده می‌شود.
REDIS_URL = os.environ['REDIS_URL']

# پیکربندی Celery برای استفاده از Redis در پروداکشن
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = False  # وظایف باید به صورت غیرهمزمان اجرا شوند.

# پیکربندی Channels برای استفاده از Redis در پروداکشن
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

# -------- DRF (Django Rest Framework) --------
# تنظیمات DRF را برای پروداکشن سخت‌گیرانه‌تر می‌کنیم.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
    "rest_framework.renderers.JSONRenderer", # حذف Browsable API
]
REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [
    "rest_framework.permissions.IsAuthenticated", # فقط کاربران لاگین کرده
]

# -------- Logging --------
# سطح لاگ‌ها در پروداکشن روی INFO تنظیم می‌شود تا لاگ‌های غیرضروری تولید نشود.
LOGGING["root"]["level"] = "INFO"

# -------- بررسی نهایی تنظیمات --------
# اطمینان از اینکه مقادیر حساس و مهم به درستی تنظیم شده‌اند.
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    raise ValueError("متغیر محیطی ALLOWED_HOSTS در پروداکشن نباید خالی باشد.")
if not CSRF_TRUSTED_ORIGINS or CSRF_TRUSTED_ORIGINS == ['']:
    raise ValueError("متغیر محیطی CSRF_TRUSTED_ORIGINS در پروداکشن نباید خالی باشد.")