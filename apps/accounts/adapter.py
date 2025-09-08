# apps/accounts/adapter.py
from django.contrib.auth import get_user_model
from django.urls import reverse, NoReverseMatch
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.utils import perform_login
from allauth.exceptions import ImmediateHttpResponse


def _success_url():
    # به نام URL خودت تنظیم کن؛ اگر نام‌گذاری نکرده‌ای، / کافیست
    try:
        return reverse("chat_page")  # اگر داری: path("", chat_page, name="chat_page")
    except NoReverseMatch:
        return "/"


class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    def _is_email_verified(self, sociallogin) -> bool:
        """
        بررسی ایمیل تأییدشده از داده‌های provider:
        - اول از email_addresses
        - بعد از extra_data['email_verified'] (برای Google معمولاً True است)
        """
        email = (sociallogin.user.email or "").lower()
        for e in getattr(sociallogin, "email_addresses", []) or []:
            if e.email.lower() == email and e.verified:
                return True
        verified = sociallogin.account.extra_data.get("email_verified")
        if isinstance(verified, bool):
            return verified
        return False

    def is_auto_signup_allowed(self, request, sociallogin):
        """
        اجازه‌ی signup خودکار بدون هیچ فرم اضافه‌ای،
        *مشروط به اینکه ایمیل تأییدشده داشته باشد.*
        """
        email = (sociallogin.user.email or "").strip()
        return bool(email) and self._is_email_verified(sociallogin)

    def pre_social_login(self, request, sociallogin):
        """
        اگر کاربری با همین ایمیل وجود داشت، اکانت سوشیال را به او وصل کن
        و بلافاصله لاگین انجام بده — بدون صفحه‌ی واسط.
        """
        # اگر همین حالا اکانت سوشیال ثبت‌شده/وصل‌شده است، کاری نکن
        if sociallogin.is_existing:
            return

        email = (sociallogin.user.email or "").strip()
        if not email:
            return  # ایمیل نداریم، بگذار فلو پیش‌فرض جلو برود

        # فقط وقتی ایمیل provider تأییدشده است merge کن
        if not self._is_email_verified(sociallogin):
            return  # امنیتی: نذار با ایمیل تأییدنشده merge شود

        User = get_user_model()
        try:
            existing = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return  # کاربر وجود ندارد؛ فلو signup خودکار انجام می‌شود

        # اتصال اکانت سوشیال به کاربر موجود
        sociallogin.connect(request, existing)

        # و بلافاصله لاگین + ری‌دایرکت به صفحه‌ی موفقیت
        resp = perform_login(
            request,
            existing,
            email_verification="none",
            redirect_url=_success_url(),
        )
        # قطع جریان پیش‌فرض و ری‌دایرکت
        raise ImmediateHttpResponse(resp)
