from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import UserManager

class User(AbstractUser):
    # حذف فیلد username و جایگزینی ایمیل به‌عنوان شناسه
    username = None
    email = models.EmailField(unique=True)

    phone_number = models.CharField(max_length=32, blank=True, null=True)
    is_phone_verified = models.BooleanField(default=False)

    avatar_url = models.URLField(blank=True)
    default_provider = models.CharField(max_length=32, blank=True, null=True)
    default_model = models.CharField(max_length=64, blank=True, null=True)

    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    last_login_ua = models.TextField(blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # چون email به‌جای username است
    objects = UserManager()
    def __str__(self):
        return self.email or super().__str__()
