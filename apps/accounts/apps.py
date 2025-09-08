# apps/accounts/apps.py
from django.apps import AppConfig
import logging

log = logging.getLogger(__name__)

class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"

    def ready(self):
        log.info("ACCOUNTS_APP_READY")
        import apps.accounts.signals  # noqa
