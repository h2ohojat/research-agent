# pyamooz_ai/settings/dev.py
from .base import *  # noqa
import os

# -------- Core --------
DEBUG = True

# ⚠️ نکته امنیتی مهم:
# فایل dev هرگز نباید حاوی دامنه‌های پروداکشن باشد.
# این لیست فقط باید شامل آدرس‌های توسعه محلی باشد.
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "[::1]",
]

# به لیست CSRF که از base.py می‌آید، آدرس‌های http لوکال را اضافه می‌کنیم
# و دامنه‌های پروداکشن را از اینجا حذف می‌کنیم.
CSRF_TRUSTED_ORIGINS += [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
# حذف موارد تکراری احتمالی برای اطمینان
CSRF_TRUSTED_ORIGINS = list(set(CSRF_TRUSTED_ORIGINS))


# -------- ✨ Middleware (برای حل مشکل فایل‌های استاتیک) ✨ --------
# WhiteNoise را برای سرو فایل‌های استاتیک در حالت توسعه با Daphne فعال می‌کنیم.
# این میدلور باید درست بعد از SecurityMiddleware قرار بگیرد.
if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
    try:
        # پیدا کردن ایندکس SecurityMiddleware برای قراردادن WhiteNoise بعد از آن
        security_middleware_index = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
        MIDDLEWARE.insert(security_middleware_index + 1, "whitenoise.middleware.WhiteNoiseMiddleware")
    except ValueError:
        # اگر SecurityMiddleware پیدا نشد، به عنوان گزینه دوم در لیست قرار بده
        MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")


# -------- Database --------
# پیش‌فرض dev همان sqlite از base است.
# اگر خواستی محلی با Postgres تست کنی: DEV_USE_POSTGRES=1 در .env بگذار.
if os.getenv("DEV_USE_POSTGRES", "0") == "1":
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "pyamooz_ai_dev"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": int(os.getenv("DB_PORT", "5432")),
        "CONN_MAX_AGE": 0,  # در dev اتصال بلندمدت لازم نیست
    }

# -------- Email --------
# در توسعه، ایمیل‌ها به کنسول چاپ می‌شوند.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# -------- DRF --------
# در dev رندرر Browsable را فعال می‌کنیم تا API راحت‌تر تست شود.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

# -------- Celery --------
# برای راحتی توسعه، وظایف Celery به‌صورت Eager (هم‌زمان) اجرا شوند.
# اگر خواستی واقعاً با Worker تست کنی: CELERY_TASK_ALWAYS_EAGER=0 در .env بگذار.
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "1") == "1"

# -------- Logging --------
# سطح لاگ را در dev پرجزئیات می‌کنیم.
LOGGING["root"]["level"] = "DEBUG"
LOGGING.setdefault("loggers", {})
for _logger in ("django", "channels", "celery"):
    LOGGING["loggers"][_logger] = {
        "handlers": ["console"],
        "level": "DEBUG",
        "propagate": True,
    }