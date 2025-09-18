# pyamooz_ai/settings/base.py
import os
from pathlib import Path
from dotenv import load_dotenv

# --- ✨ CRITICAL FIX: Explicitly load .env from the project root ---
# This ensures .env is found regardless of how the server is started.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE_PATH)

# --- Core ---
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
DEBUG = os.getenv("DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")

# Django 5 default id field (افزوده شد)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Locale & Time (افزوده شد؛ با پیش‌فرض تهران، قابل override از .env)
LANGUAGE_CODE = os.getenv("LANGUAGE_CODE", "fa")
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Tehran")
USE_I18N = True
USE_TZ = True

INSTALLED_APPS = [
    # Third-party server FIRST (دقت: daphne باید قبل از staticfiles باشد)
    "daphne",

    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",

    # Third-party
    "rest_framework",
    "channels",

    # allauth (social login)
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",

    # Local apps
    "apps.realtime",
    "apps.queueapp",
    "apps.gateway",
    "apps.chat",
    "apps.frontend",
    "apps.accounts",
    "apps.models",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SITE_ID = int(os.getenv("SITE_ID", "1"))

# مسیرهای ورود/خروج
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

ROOT_URLCONF = "pyamooz_ai.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {
        "context_processors": [
            "django.template.context_processors.debug",
            "django.template.context_processors.request",  # لازم برای allauth
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ],
    },
}]

WSGI_APPLICATION = "pyamooz_ai.wsgi.application"
ASGI_APPLICATION = "pyamooz_ai.asgi.application"

# --- Database (dev: sqlite) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --- Channels / Redis ---
REDIS_URL = os.getenv("REDIS_URL")  # مثل: redis://127.0.0.1:6379
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# --- Celery ---
CELERY_BROKER_URL = (
    os.getenv("CELERY_BROKER_URL")
    or (f"{REDIS_URL}/1" if REDIS_URL else "memory://")
)
CELERY_RESULT_BACKEND = (
    os.getenv("CELERY_RESULT_BACKEND")
    or (f"{REDIS_URL}/2" if REDIS_URL else "cache+memory://")
)
# هماهنگ با TZ پروژه؛ قابل override با CELERY_TIMEZONE در .env
CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE", TIME_ZONE)

# --- Static ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
        "messages": "30/min",
    },
}

# --- App specifics ---
MAX_PROMPT_CHARS = int(os.getenv("MAX_PROMPT_CHARS", "4000"))
AUTH_USER_MODEL = "accounts.User"

# --- allauth (API مدرن) ---
ACCOUNT_LOGIN_METHODS = {"email"}                 # فقط ایمیل
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None          # مدل User فیلد username ندارد
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = os.getenv("ACCOUNT_EMAIL_VERIFICATION", "none")

SOCIALACCOUNT_EMAIL_REQUIRED = True
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_QUERY_EMAIL = True
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapter.MySocialAccountAdapter"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": ["email", "profile"],
        "AUTH_PARAMS": {"prompt": "select_account"},
        # اگر بخواهی next یا چیز دیگری بدهی می‌توانی params دیگری هم اضافه کنی
    }
}

# CSRF: لیست لوکال شما حفظ می‌شود؛ به‌علاوه مقادیر .env و دامنه‌های ALLOWED_HOSTS به‌صورت https
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
_csrf_from_env = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS += _csrf_from_env
CSRF_TRUSTED_ORIGINS += [f"https://{h.strip()}" for h in ALLOWED_HOSTS if h and h.strip() and h.strip() != "*"]
# حذف تکراری‌ها
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(CSRF_TRUSTED_ORIGINS))

# --- Logging (JSON to stdout) ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        }
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}

# تنظیمات مدل‌ها (حفظ‌شده)
MODEL_SETTINGS = {
    'AVALAI_API_URL': 'https://api.avalai.ir/public/models',
    'CACHE_TIMEOUT': 300,  # 5 دقیقه
    'SYNC_INTERVAL': 3600,  # 1 ساعت
    'DEFAULT_GUEST_MODELS': [
        'gpt-3.5-turbo',
        'gpt-4o-mini',
    ],
    'RATE_LIMIT_WINDOW': 60,  # ثانیه
}
