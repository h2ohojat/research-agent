# pyamooz_ai/settings/dev.py
from .base import *  # noqa
import os
import dj_database_url

# -------- تنظیمات هسته برای محیط توسعه --------
# این مقادیر، تنظیمات پایه را برای توسعه محلی بازنویسی می‌کنند.

# یک کلید امنیتی ساده برای توسعه. این کلید هرگز نباید در پروداکشن استفاده شود.
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-secret-key-for-development')

# حالت دیباگ در توسعه همیشه روشن است تا خطاها به وضوح نمایش داده شوند.
DEBUG = True

# آدرس‌های مجاز برای دسترسی به سرور توسعه محلی.
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "[::1]",
]

# -------- امنیت (CSRF) --------
# دامنه‌هایی که در محیط توسعه برای ارسال فرم‌ها امن شناخته می‌شوند.
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

# -------- Middleware (برای سرو فایل‌های استاتیک) --------
# WhiteNoise را برای سرو صحیح فایل‌های استاتیک توسط Daphne در حالت توسعه اضافه می‌کنیم.
# این میدلور باید درست بعد از SecurityMiddleware قرار بگیرد.
if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
    try:
        security_middleware_index = MIDDLEWARE.index("django.middleware.security.Middleware")
        MIDDLEWARE.insert(security_middleware_index + 1, "whitenoise.middleware.WhiteNoiseMiddleware")
    except ValueError:
        MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

# -------- پایگاه داده --------
# منطق قبلی شما برای استفاده اختیاری از Postgres محلی حفظ شده است.
# برای فعال‌سازی، در فایل .env متغیر DEV_USE_POSTGRES=1 را قرار دهید.
# در غیر این صورت، از همان SQLite تعریف شده در base.py استفاده می‌شود.
if os.getenv("DEV_USE_POSTGRES", "0") == "1":
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "pyamooz_ai_dev"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": int(os.getenv("DB_PORT", "5432")),
    }

# -------- ایمیل --------
# در محیط توسعه، تمام ایمیل‌های ارسالی به جای ارسال واقعی، در کنسول چاپ می‌شوند.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# -------- DRF (Django Rest Framework) --------
# رندرکننده Browsable API را برای تست آسان APIها در مرورگر فعال می‌کنیم.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

# -------- Celery / Channels / Redis --------
# آدرس سرور Redis را برای توسعه محلی تعریف می‌کنیم.
# این مقدار، تنظیمات InMemory تعریف شده در base.py را بازنویسی می‌کند.
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# پیکربندی Celery برای استفاده از Redis
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# در توسعه، وظایف Celery به صورت همزمان (بدون نیاز به Worker) اجرا می‌شوند.
# برای تست واقعی، در .env متغیر CELERY_TASK_ALWAYS_EAGER=0 را قرار دهید.
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "1") == "1"

# پیکربندی Channels برای استفاده از Redis
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

# -------- Logging --------
# سطح لاگ‌ها را روی DEBUG تنظیم می‌کنیم تا جزئیات بیشتری در کنسول نمایش داده شود.
LOGGING["root"]["level"] = "DEBUG"
LOGGING.setdefault("loggers", {})
for _logger in ("django", "channels", "celery"):
    LOGGING["loggers"][_logger] = {
        "handlers": ["console"],
        "level": "DEBUG",
        "propagate": True,
    }