# pyamooz_ai/settings/base.py
import os
from pathlib import Path
from dotenv import load_dotenv

# --- مسیردهی و بارگذاری متغیرهای محیطی ---
# این بخش به صورت هوشمند فایل .env را از ریشه پروژه پیدا و بارگذاری می‌کند.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = BASE_DIR / ".env"
if ENV_FILE_PATH.exists():
    load_dotenv(dotenv_path=ENV_FILE_PATH)

# --- تنظیمات هسته جنگو (مشترک بین همه محیط‌ها) ---
# این تنظیمات باید در تمام محیط‌ها یکسان باشند.
# مقادیر حساس یا وابسته به محیط از این فایل حذف شده‌اند.

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# منطقه زمانی و زبان
LANGUAGE_CODE = os.getenv("LANGUAGE_CODE", "fa")
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Tehran")
USE_I18N = True
USE_TZ = True

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "channels",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
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

ROOT_URLCONF = "pyamooz_ai.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {
        "context_processors": [
            "django.template.context_processors.debug",
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ],
    },
}]

WSGI_APPLICATION = "pyamooz_ai.wsgi.application"
ASGI_APPLICATION = "pyamooz_ai.asgi.application"

# --- پایگاه داده ---
# یک پایگاه داده پیش‌فرض برای راحتی کار تعریف شده است.
# این تنظیم در فایل‌های dev.py و prod.py بازنویسی (override) خواهد شد.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --- احراز هویت و کاربران ---
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
SITE_ID = int(os.getenv("SITE_ID", "1"))
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

# --- فایل‌های استاتیک ---
STATIC_URL = "static/"
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'apps/frontend/static'),
]

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')


# --- Channels / Redis / Celery (پیش‌فرض‌های امن برای توسعه) ---
# این بخش‌ها ساختار کلی را تعریف می‌کنند. مقادیر واقعی (URL ها)
# باید در فایل‌های dev.py و prod.py مشخص شوند.
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_TIMEZONE = TIME_ZONE

# --- DRF (تنظیمات پایه) ---
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

# --- تنظیمات خاص برنامه ---
MAX_PROMPT_CHARS = int(os.getenv("MAX_PROMPT_CHARS", "4000"))
MODEL_SETTINGS = {
    'AVALAI_API_URL': 'https://api.avalai.ir/public/models',
    'CACHE_TIMEOUT': 300,
    'SYNC_INTERVAL': 3600,
    'DEFAULT_GUEST_MODELS': ['gpt-3.5-turbo', 'gpt-4o-mini'],
    'RATE_LIMIT_WINDOW': 60,
}

# --- allauth (تنظیمات مشترک) ---
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
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
    }
}

# --- CSRF ---
# یک لیست پایه خالی. این لیست در dev.py و prod.py پر خواهد شد.
CSRF_TRUSTED_ORIGINS = []

# --- Logging (ساختار پایه) ---
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