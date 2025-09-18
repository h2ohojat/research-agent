# pyamooz_ai/settings/prod.py
from .base import *  # noqa
import os

# -------------------------
# Core
# -------------------------
DEBUG = False

# اطمینان از کلید و دامنه‌ها
if not SECRET_KEY or SECRET_KEY in ("dev-secret", "change-me"):
    raise RuntimeError("SECRET_KEY در پروڈاکشن تنظیم نشده یا ناامن است.")

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ["*"]:
    raise RuntimeError("ALLOWED_HOSTS در پروڈاکشن باید به دامنه‌های مشخص محدود شود.")

# اگر در .env مقدار CSRF_TRUSTED_ORIGINS ست نشده، از ALLOWED_HOSTS نسخهٔ https بساز
if not os.getenv("CSRF_TRUSTED_ORIGINS", "").strip():
    CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h and h != "*"]

# -------------------------
# Security
# -------------------------
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# HSTS (قابل تنظیم از طریق env)
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", str(31536000)))  # 1 سال
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", "0") == "1"
SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", "0") == "1"

X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SECURE_CONTENT_TYPE_NOSNIFF = True  # از Django 5 به بعد True است، این‌جا هم صراحتاً ست می‌کنیم

# -------------------------
# Database (Postgres الزامی در Prod)
# -------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": int(os.getenv("DB_PORT", "5432")),
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
    }
}
if not DATABASES["default"]["NAME"]:
    raise RuntimeError("پارامترهای Postgres (DB_NAME/DB_USER/DB_PASSWORD/...) برای پروڈاکشن ست نشده است.")

# -------------------------
# Static files (WhiteNoise اختیاری)
# اگر استاتیک را Nginx می‌دهد، USE_WHITENOISE=0 نگه دار.
# اگر می‌خواهی از خود Django سرو شود، USE_WHITENOISE=1 کن.
# -------------------------
USE_WHITENOISE = os.getenv("USE_WHITENOISE", "0") == "1"
if USE_WHITENOISE:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }

# -------------------------
# DRF (سخت‌گیرتر از dev)
# -------------------------
REST_FRAMEWORK.update({
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("DRF_THROTTLE_ANON", "30/min"),
        "user": os.getenv("DRF_THROTTLE_USER", "60/min"),
    },
})

# -------------------------
# Logging (JSON قابل انتخاب)
# USE_JSON_LOGS=1 → python-json-logger
# USE_JSON_LOGS=0 → همان کنسول سادهٔ base
# -------------------------
USE_JSON_LOGS = os.getenv("USE_JSON_LOGS", "1") == "1"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

if USE_JSON_LOGS:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": "python_json_logger.jsonlogger.JsonFormatter",
                "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s",
            }
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler", "formatter": "json"},
        },
        "root": {"handlers": ["console"], "level": LOG_LEVEL},
    }
else:
    LOGGING["root"]["level"] = LOG_LEVEL
    LOGGING.setdefault("loggers", {})
    for _logger in ("django", "channels", "celery"):
        LOGGING["loggers"][_logger] = {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": True,
        }

# -------------------------
# Email (از base خوانده می‌شود؛ در .env مقادیر SMTP را ست کن)
# -------------------------
SERVER_EMAIL = os.getenv("SERVER_EMAIL", "server@hemmatai.ir")
ADMINS = []  # نمونه: [("Hojjat", "ops@hemmatai.ir")]
MANAGERS = ADMINS

# یادآوری: TIME_ZONE و CELERY_TIMEZONE از base و .env (Asia/Tehran) اعمال شده‌اند.
