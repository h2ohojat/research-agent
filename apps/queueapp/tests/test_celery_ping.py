from apps.queueapp.tasks import ping

def test_celery_ping(settings):
    # اطمینان از اجرای eager و memory broker در تست
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.CELERY_BROKER_URL = "memory://localhost/"
    settings.CELERY_RESULT_BACKEND = "cache+memory://"
    assert ping.delay().get(timeout=2) == "pong"
