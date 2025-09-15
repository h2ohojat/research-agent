# pyamooz_ai/wsgi.py
import os
from django.core.wsgi import get_wsgi_application

# ✅ محیط باید صراحتاً ست شده باشد؛ در غیر اینصورت خطا بده
if not os.getenv("DJANGO_SETTINGS_MODULE"):
    raise RuntimeError(
        "DJANGO_SETTINGS_MODULE تعریف نشده است. "
        "در محیط توسعه: pyamooz_ai.settings.dev "
        "و در محیط تولید: pyamooz_ai.settings.prod را ست کنید."
    )

application = get_wsgi_application()
