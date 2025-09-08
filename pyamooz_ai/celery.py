import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pyamooz_ai.settings.dev")
app = Celery("pyamooz_ai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
