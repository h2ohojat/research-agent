import logging
import threading
from django.apps import AppConfig
from django.db import OperationalError

# یک لاگر برای این ماژول تعریف می‌کنیم تا پیام‌ها را در کنسول ببینیم
logger = logging.getLogger(__name__)

class ModelsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.models"

    def ready(self):
        """
        این متد زمانی اجرا می‌شود که Django آماده به کار شود.
        ما از آن برای اجرای همگام‌سازی اولیه مدل‌ها در صورت خالی بودن دیتابیس استفاده می‌کنیم.
        """
        # ایمپورت‌ها را در اینجا انجام می‌دهیم تا از خطای AppRegistryNotReady جلوگیری شود.
        # این یک روش استاندارد در Django است.
        from .models import AIModel
        from .services.model_manager import model_manager

        def run_initial_sync():
            """
            این تابع منطق اصلی همگام‌سازی را در خود دارد و قرار است در یک thread جداگانه اجرا شود.
            """
            try:
                # بررسی می‌کنیم که آیا حتی یک مدل در دیتابیس وجود دارد یا خیر.
                # استفاده از .exists() بسیار بهینه‌تر از .count() == 0 است.
                if not AIModel.objects.exists():
                    logger.info("🚀 Database is empty. Starting initial model sync from AvalAI...")
                    try:
                        result = model_manager.sync_models_from_avalai(force_refresh=True)
                        logger.info(f"✅ Auto-sync completed successfully. Result: {result}")
                    except Exception as e:
                        logger.error(f"❌ Auto-sync failed during API call: {str(e)}")
                else:
                    logger.info("✅ Models already exist in the database. Skipping auto-sync.")
            
            except OperationalError:
                # این خطا معمولاً زمانی رخ می‌دهد که دیتابیس هنوز آماده نیست (مثلاً هنگام اجرای migrate).
                # در این حالت، ما به سادگی از همگام‌سازی صرف‌نظر می‌کنیم.
                logger.warning("Could not connect to the database to check for models. Skipping auto-sync. This is normal during migrations.")
            except Exception as e:
                # گرفتن خطاهای غیرمنتظره دیگر
                logger.error(f"❌ An unexpected error occurred in auto-sync thread: {str(e)}")

        # اجرای همگام‌سازی در یک thread جداگانه برای جلوگیری از بلاک شدن فرآیند اصلی راه‌اندازی سرور.
        # این کار باعث می‌شود سرور سریع‌تر بالا بیاید، حتی اگر API AvalAI کند باشد یا در دسترس نباشد.
        # daemon=True باعث می‌شود که اگر برنامه اصلی بسته شد، این thread هم به طور خودکار بسته شود.
        sync_thread = threading.Thread(target=run_initial_sync, daemon=True)
        sync_thread.start()