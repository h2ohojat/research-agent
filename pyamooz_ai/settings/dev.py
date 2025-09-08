from .base import *

DEBUG = True

# در dev ترجیحاً Redis Docker داری:
# .env:
# REDIS_URL=redis://127.0.0.1:6379
# CELERY_BROKER_URL=redis://127.0.0.1:6379/1
# CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/2

# اگر Redis نداشتی، base به طور خودکار memory را فعال می‌کند.
