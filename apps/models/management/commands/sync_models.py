from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.models.services.model_manager import model_manager
from apps.models.services.avalai_service import avalai_service

class Command(BaseCommand):
    help = 'همگام‌سازی مدل‌ها از AvalAI'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='اجبار به دریافت جدید (نادیده گرفتن کش)',
        )
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            help='پاک کردن کش قبل از همگام‌سازی',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🔄 شروع همگام‌سازی مدل‌ها از AvalAI...')
        )
        
        start_time = timezone.now()
        
        try:
            # پاک کردن کش در صورت درخواست
            if options['clear_cache']:
                avalai_service.clear_cache()
                self.stdout.write('🗑️ کش پاک شد')
            
            # همگام‌سازی مدل‌ها
            result = model_manager.sync_models_from_avalai(
                force_refresh=options['force']
            )
            
            if result['success']:
                stats = result['stats']
                duration = (timezone.now() - start_time).total_seconds()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ همگام‌سازی با موفقیت انجام شد!\n'
                        f'📊 آمار:\n'
                        f'  - کل مدل‌ها: {stats["total"]}\n'
                        f'  - ایجاد شده: {stats["created"]}\n'
                        f'  - به‌روزرسانی شده: {stats["updated"]}\n'
                        f'  - خطاها: {stats["errors"]}\n'
                        f'⏱️ مدت زمان: {duration:.2f} ثانیه'
                    )
                )
                
                if stats['errors'] > 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠️ {stats["errors"]} مدل با خطا مواجه شد. '
                            'لطفاً لاگ‌ها را بررسی کنید.'
                        )
                    )
            else:
                raise CommandError(f'❌ همگام‌سازی ناموفق: {result["message"]}')
                
        except Exception as e:
            raise CommandError(f'❌ خطای غیرمنتظره: {str(e)}')