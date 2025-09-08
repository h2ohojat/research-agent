# apps/accounts/signals.py
import logging
from django.dispatch import receiver
from allauth.account.signals import user_logged_in, user_signed_up
from apps.chat.models import Conversation

log = logging.getLogger(__name__)

def _claim(request, user):
    try:
        ids = request.session.get("guest_conversations", [])
        if not isinstance(ids, list):
            ids = []
        updated = Conversation.objects.filter(id__in=ids, owner__isnull=True).update(owner=user)
        log.info("CLAIM_CONVERSATIONS", extra={"ids": ids, "updated": updated, "user_id": user.id})
        # بعد از Claim، سشن رو خالی می‌کنیم
        request.session["guest_conversations"] = []
        request.session.modified = True
    except Exception as e:
        log.exception("CLAIM_CONVERSATIONS_FAILED", extra={"error": str(e)})

@receiver(user_logged_in)
def claim_on_login(request, user, **kwargs):
    log.info("SIGNAL_user_logged_in", extra={"user_id": user.id})
    _claim(request, user)

@receiver(user_signed_up)
def claim_on_signup(request, user, **kwargs):
    # برخی فلوها اول signup بعد login هستند — اینجا هم Claim می‌کنیم
    log.info("SIGNAL_user_signed_up", extra={"user_id": user.id})
    _claim(request, user)
