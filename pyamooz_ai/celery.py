# pyamooz_ai/celery.py
import os
from celery import Celery

# ✅ محیط باید صراحتاً ست شده باشد؛ در غیر اینصورت خطا بده
if not os.getenv("DJANGO_SETTINGS_MODULE"):
    raise RuntimeError(
        "DJANGO_SETTINGS_MODULE تعریف نشده است. "
        "در محیط توسعه: pyamooz_ai.settings.dev "
        "و در محیط تولید: pyamooz_ai.settings.prod را ست کنید."
    )

app = Celery("pyamooz_ai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# (اختیاریِ پیشنهادی)
# app.conf.update(
#     task_acks_late=True,
#     worker_max_tasks_per_child=1000,
#     broker_connection_retry_on_startup=True,
#     task_time_limit=60*5,
#     task_soft_time_limit=60*4,
# )
