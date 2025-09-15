"""
URL configuration for pyamooz_ai project.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.cache import never_cache
from django.db import connections
from django.db.utils import OperationalError


@never_cache
@require_GET
def healthz(_request):
    """
    Liveness probe: اگر وب‌سرور زنده است 200 می‌دهیم.
    """
    return JsonResponse({"status": "ok"}, status=200)


@never_cache
@require_GET
def readyz(_request):
    """
    Readiness probe: وضعیت وابستگی‌های حیاتی (مثل DB) را چک می‌کنیم.
    اگر DB در دسترس نباشد، 503 می‌دهیم تا پروکسی/ارکستریتور درخواست‌ها را به نمونه سالم بفرستد.
    """
    checks = {}
    db_ok = True

    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except OperationalError:
        db_ok = False

    checks["database"] = db_ok

    overall_ok = db_ok  # اگر بعداً Redis/Queue هم اضافه شد، اینجا لحاظ کن
    status_code = 200 if overall_ok else 503

    return JsonResponse(
        {
            "status": "ok" if overall_ok else "degraded",
            "checks": checks,
        },
        status=status_code,
    )


urlpatterns = [
    # Health/Ready
    path("healthz/", healthz),
    path("readyz/", readyz),

    # Admin
    path("admin/", admin.site.urls),

    # Auth (allauth)
    path("accounts/", include("allauth.urls")),

    # APIs
    path("api/v1/", include("apps.chat.api.urls")),
    path("api/models/", include("apps.models.urls")),

    # Frontend
    path("", include("apps.frontend.urls")),
]
