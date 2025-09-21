import logging
from typing import List, Dict, Optional, TYPE_CHECKING
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Sum, QuerySet
from datetime import timedelta

from ..models import AIModel, ModelProvider, UserModelPermission, ModelUsageLog
from .avalai_service import avalai_service

# Type checking imports
if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

User = get_user_model()
logger = logging.getLogger(__name__)

class ModelManager:
    """مدیر اصلی مدل‌ها"""
    
    def sync_models_from_avalai(self, force_refresh: bool = False) -> Dict:
        """
        همگام‌سازی مدل‌ها از AvalAI
        
        Args:
            force_refresh: اجبار به دریافت جدید
            
        Returns:
            Dict: گزارش همگام‌سازی
        """
        logger.info("🔄 Starting model synchronization...")
        
        # دریافت مدل‌ها از AvalAI
        avalai_models = avalai_service.fetch_models(force_refresh)
        
        if not avalai_models:
            return {
                'success': False,
                'message': 'Failed to fetch models from AvalAI',
                'stats': {'total': 0, 'created': 0, 'updated': 0, 'errors': 0}
            }
        
        stats = {'total': len(avalai_models), 'created': 0, 'updated': 0, 'errors': 0}
        
        for model_data in avalai_models:
            try:
                self._sync_single_model(model_data, stats)
            except Exception as e:
                logger.error(f"❌ Error syncing model {model_data.get('id', 'unknown')}: {str(e)}")
                stats['errors'] += 1
        
        logger.info(f"✅ Model sync completed: {stats}")
        
        return {
            'success': True,
            'message': f"Synced {stats['total']} models",
            'stats': stats
        }
    
    def _sync_single_model(self, model_data: Dict, stats: Dict):
        """همگام‌سازی یک مدل با مدیریت مقادیر NULL"""
        model_id = model_data.get('id')
        if not model_id:
            return
        
        # پیدا کردن یا ایجاد provider
        provider_name = model_data.get('owned_by', 'unknown')
        provider, created = ModelProvider.objects.get_or_create(
            name=provider_name,
            defaults={
                'display_name': provider_name.title(),
                'is_active': True
            }
        )
        
        # تعیین tier بر اساس قیمت و محدودیت‌ها
        tier = self._determine_model_tier(model_data)
        
        # آماده‌سازی محدودیت‌ها با مقادیر پیش‌فرض
        limits = {
            'max_requests_per_minute': model_data.get('max_requests_per_1_minute') or 60,
            'max_tokens_per_minute': model_data.get('max_tokens_per_1_minute') or 150000,
            'max_tokens': model_data.get('max_tokens') or 4096,
            'max_input_tokens': model_data.get('max_input_tokens') or 4096,
            'max_output_tokens': model_data.get('max_output_tokens') or 4096,
        }
        
        # آماده‌سازی قابلیت‌ها
        capabilities = {
            'supports_vision': model_data.get('supports_vision', False),
            'supports_function_calling': model_data.get('supports_function_calling', False),
            'supports_tool_choice': model_data.get('supports_tool_choice', False),
            'supports_response_schema': model_data.get('supports_response_schema', False),
        }
        
        # پیدا کردن یا ایجاد مدل
        model, created = AIModel.objects.get_or_create(
            model_id=model_id,
            defaults={
                'display_name': self._generate_display_name(model_data),
                'provider': provider,
                'tier': tier,
                'is_active': True,
                'pricing_data': model_data.get('pricing', {}),
                'metadata': model_data,
                'last_synced': timezone.now(),
                **limits,
                **capabilities
            }
        )
        
        if created:
            stats['created'] += 1
            return
        
        # به‌روزرسانی مدل موجود
        updated_fields = []
        
        # به‌روزرسانی فیلدهای اصلی
        new_display_name = self._generate_display_name(model_data)
        if model.display_name != new_display_name:
            model.display_name = new_display_name
            updated_fields.append('display_name')
        
        if model.tier != tier:
            model.tier = tier
            updated_fields.append('tier')
        
        # به‌روزرسانی محدودیت‌ها
        for field, value in limits.items():
            if getattr(model, field) != value:
                setattr(model, field, value)
                updated_fields.append(field)
        
        # به‌روزرسانی قابلیت‌ها
        for field, value in capabilities.items():
            if getattr(model, field) != value:
                setattr(model, field, value)
                updated_fields.append(field)
        
        # به‌روزرسانی قیمت‌گذاری و متادیتا
        new_pricing = model_data.get('pricing', {})
        if model.pricing_data != new_pricing:
            model.pricing_data = new_pricing
            updated_fields.append('pricing_data')
        
        if model.metadata != model_data:
            model.metadata = model_data
            updated_fields.append('metadata')
        
        # زمان آخرین همگام‌سازی
        model.last_synced = timezone.now()
        updated_fields.append('last_synced')
        
        # ذخیره تغییرات
        if updated_fields:
            model.save(update_fields=updated_fields)
            stats['updated'] += 1
    
    def _determine_model_tier(self, model_data: Dict) -> str:
        """تعیین tier مدل بر اساس متادیتا"""
        from ..models import AIModel
        
        # منطق تعیین tier
        min_tier = model_data.get('min_tier', 0)
        pricing = model_data.get('pricing', {})
        
        # اگر قیمت بالا یا min_tier بالا باشد
        if min_tier >= 3 or (pricing and pricing.get('input', 0) > 0.01):
            return AIModel.ModelTier.ENTERPRISE
        elif min_tier >= 2 or (pricing and pricing.get('input', 0) > 0.001):
            return AIModel.ModelTier.PREMIUM
        elif min_tier >= 1:
            return AIModel.ModelTier.BASIC
        else:
            return AIModel.ModelTier.FREE
    
    def _generate_display_name(self, model_data: Dict) -> str:
        """تولید نام نمایشی برای مدل"""
        model_id = model_data.get('id', '')
        
        # تمیز کردن نام
        display_name = model_id.replace('openai.', '').replace(':0', '')
        
        # تبدیل به فرمت قابل خواندن
        parts = display_name.split('-')
        if len(parts) > 1:
            # مثل gpt-4o-mini -> GPT-4o Mini
            formatted_parts = []
            for part in parts:
                if part.lower() in ['gpt', 'claude', 'llama']:
                    formatted_parts.append(part.upper())
                elif part.isdigit() or any(c.isdigit() for c in part):
                    formatted_parts.append(part)
                else:
                    formatted_parts.append(part.capitalize())
            return ' '.join(formatted_parts)
        
        return display_name.capitalize()
    
    # <<<<<<<<<<<<<<< [تغییر کلیدی] این متد حالا همیشه QuerySet برمی‌گرداند >>>>>>>>>>>>>>>
    def get_available_models_for_user(self, user: Optional['AbstractUser'] = None, base_queryset: Optional[QuerySet] = None) -> QuerySet:
        """
        دریافت مدل‌های قابل دسترس برای کاربر
        
        Args:
            user: کاربر (None برای مهمان)
            base_queryset: QuerySet پایه (اختیاری) - برای بهینه‌سازی
            
        Returns:
            QuerySet: QuerySet مدل‌های قابل دسترس
        """
        # اگر base_queryset داده شده، از آن استفاده می‌کنیم، وگرنه یک QuerySet پایه می‌سازیم
        if base_queryset is not None:
            base_qs = base_queryset.filter(is_active=True)
        else:
            base_qs = AIModel.objects.filter(is_active=True)
        
        if user and user.is_authenticated:
            # کاربر لاگین شده
            if user.is_superuser:
                # ادمین: همه مدل‌ها
                return base_qs.order_by('provider__name', 'display_name')
            else:
                # کاربر عادی: مدل‌های مجاز + رایگان
                user_models = base_qs.filter(
                    usermodelpermission__user=user,
                    usermodelpermission__is_active=True
                ).distinct()
                
                free_models = base_qs.filter(
                    tier=AIModel.ModelTier.FREE
                )
                
                return (user_models | free_models).distinct().order_by('provider__name', 'display_name')
        else:
            # کاربر مهمان: فقط مدل‌های رایگان
            return base_qs.filter(
                tier=AIModel.ModelTier.FREE
            ).order_by('provider__name', 'display_name')
    
    # <<<<<<<<<<<<<<< [تغییر کلیدی] این متد هم حالا QuerySet برمی‌گرداند >>>>>>>>>>>>>>>
    def get_models_by_tier(self, tier: str) -> QuerySet:
        """
        دریافت مدل‌ها بر اساس tier
        
        Args:
            tier: نوع tier (free, basic, premium, enterprise)
            
        Returns:
            QuerySet: QuerySet مدل‌های tier مشخص شده
        """
        return AIModel.objects.filter(
            is_active=True,
            tier=tier
        ).order_by('provider__name', 'display_name')
    
    def get_model_by_id(self, model_id: str) -> Optional[AIModel]:
        """
        دریافت مدل بر اساس model_id
        
        Args:
            model_id: شناسه مدل
            
        Returns:
            AIModel یا None
        """
        try:
            return AIModel.objects.get(model_id=model_id, is_active=True)
        except AIModel.DoesNotExist:
            return None
    
    def check_user_model_access(self, user: Optional['AbstractUser'], model_id: str) -> bool:
        """
        بررسی دسترسی کاربر به مدل خاص
        
        Args:
            user: کاربر
            model_id: شناسه مدل
            
        Returns:
            bool: آیا کاربر دسترسی دارد یا نه
        """
        model = self.get_model_by_id(model_id)
        if not model:
            return False
        
        # مدل‌های رایگان برای همه قابل دسترس هستند
        if model.tier == AIModel.ModelTier.FREE:
            return True
        
        # کاربران مهمان فقط به مدل‌های رایگان دسترسی دارند
        if not user or not user.is_authenticated:
            return False
        
        # ادمین‌ها به همه مدل‌ها دسترسی دارند
        if user.is_superuser:
            return True
        
        # بررسی مجوز خاص کاربر
        return UserModelPermission.objects.filter(
            user=user,
            model=model,
            is_active=True
        ).exists()
    
    def get_model_usage_stats(self, model_id: str, days: int = 7) -> Dict:
        """
        دریافت آمار استفاده از مدل
        
        Args:
            model_id: شناسه مدل
            days: تعداد روزهای گذشته
            
        Returns:
            Dict: آمار استفاده
        """
        model = self.get_model_by_id(model_id)
        if not model:
            return {'error': 'Model not found'}
        
        from_date = timezone.now() - timedelta(days=days)
        
        logs = ModelUsageLog.objects.filter(
            model=model,
            request_timestamp__gte=from_date
        )
        
        total_requests = logs.count()
        successful_requests = logs.filter(success=True).count()
        total_tokens = logs.aggregate(
            total=Sum('tokens_used')  # ✅ تصحیح شده
        )['total'] or 0
        
        return {
            'model_id': model_id,
            'period_days': days,
            'total_requests': total_requests,
            'successful_requests': successful_requests,
            'failed_requests': total_requests - successful_requests,
            'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0,
            'total_tokens_used': total_tokens,
            'average_tokens_per_request': total_tokens / total_requests if total_requests > 0 else 0
        }

# Instance سراسری
model_manager = ModelManager()