from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django import forms
from .models import User

class MyUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email",)

class MyUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = ("email", "first_name", "last_name", "phone_number", "is_phone_verified",
                  "avatar_url", "default_provider", "default_model")

@admin.register(User)
class MyUserAdmin(UserAdmin):
    add_form = MyUserCreationForm
    form = MyUserChangeForm
    model = User
    list_display = ("email", "first_name", "last_name", "phone_number", "is_staff", "is_active")
    list_filter = ("is_staff", "is_active", "is_superuser", "is_phone_verified")
    ordering = ("email",)
    search_fields = ("email", "first_name", "last_name", "phone_number")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone_number", "is_phone_verified",
                                      "avatar_url", "default_provider", "default_model")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined", "last_login_ip", "last_login_ua")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "is_staff", "is_active")}
        ),
    )
