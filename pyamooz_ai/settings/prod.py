from .base import *

DEBUG = False

# این‌ها را در سرور واقعی با HTTPS فعال کن
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True

# (پیشنهادی)
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False  # اگر ساب‌دامین‌ها هم HTTPS هستند True کن
SECURE_HSTS_PRELOAD = False

# در prod حتماً از env ست کن:
# SECRET_KEY, ALLOWED_HOSTS, REDIS_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND, EMAIL_* و...
