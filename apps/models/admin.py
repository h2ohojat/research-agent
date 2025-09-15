from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import ModelProvider, AIModel, UserModelPermission, ModelUsageLog

@admin.register(ModelProvider)
class ModelProviderAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'name', 'is_active', 'model_count', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'display_name']
    readonly_fields = ['created_at']
    
    def model_count(self, obj):
        count = obj.aimodel_set.count()
        url = reverse('admin:models_aimodel_changelist') + f'?provider__id__exact={obj.id}'
        return format_html('<a href="{}">{} مدل</a>', url, count)
    model_count.short_description = 'تعداد مدل‌ها'

@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = [
        'display_name', 'model_id', 'provider', 'tier', 'is_active', 
        'supports_vision', 'supports_function_calling', 'last_synced'
    ]
    list_filter = [
        'tier', 'is_active', 'provider', 'supports_vision', 
        'supports_function_calling', 'supports_tool_choice'
    ]
    search_fields = ['model_id', 'display_name', 'provider__name']
    readonly_fields = [
        'model_id', 'created_at', 'updated_at', 'last_synced', 
        'metadata_display', 'pricing_display'
    ]
    
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('model_id', 'display_name', 'provider', 'tier', 'is_active')
        }),
        ('محدودیت‌ها', {
            'fields': (
                'max_requests_per_minute', 'max_tokens_per_minute', 
                'max_tokens', 'max_input_tokens', 'max_output_tokens'
            )
        }),
        ('قابلیت‌ها', {
            'fields': (
                'supports_vision', 'supports_function_calling', 
                'supports_tool_choice', 'supports_response_schema'
            )
        }),
        ('اطلاعات تکمیلی', {
            'fields': ('pricing_display', 'metadata_display'),
            'classes': ('collapse',)
        }),
        ('زمان‌ها', {
            'fields': ('created_at', 'updated_at', 'last_synced'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_models', 'deactivate_models', 'sync_selected_models']
    
    def metadata_display(self, obj):
        if obj.metadata:
            import json
            formatted_json = json.dumps(obj.metadata, indent=2, ensure_ascii=False)
            return format_html('<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto;">{}</pre>', formatted_json)
        return '-'
    metadata_display.short_description = 'متادیتا'
    
    def pricing_display(self, obj):
        if obj.pricing_data:
            import json
            formatted_json = json.dumps(obj.pricing_data, indent=2, ensure_ascii=False)
            return format_html('<pre style="background: #e8f5e8; padding: 10px; border-radius: 4px;">{}</pre>', formatted_json)
        return '-'
    pricing_display.short_description = 'قیمت‌گذاری'
    
    def activate_models(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} مدل فعال شد.')
    activate_models.short_description = 'فعال کردن مدل‌های انتخاب شده'
    
    def deactivate_models(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} مدل غیرفعال شد.')
    deactivate_models.short_description = 'غیرفعال کردن مدل‌های انتخاب شده'
    
    def sync_selected_models(self, request, queryset):
        from .services.model_manager import model_manager
        from .services.avalai_service import avalai_service
        
        # دریافت مدل‌های جدید از API
        avalai_models = avalai_service.fetch_models(force_refresh=True)
        avalai_model_ids = {model.get('id') for model in avalai_models}
        
        synced_count = 0
        for model in queryset:
            if model.model_id in avalai_model_ids:
                # پیدا کردن داده‌های جدید
                model_data = next(
                    (m for m in avalai_models if m.get('id') == model.model_id), 
                    None
                )
                if model_data:
                    # به‌روزرسانی مدل
                    stats = {'updated': 0}
                    model_manager._sync_single_model(model_data, stats)
                    synced_count += stats.get('updated', 0)
        
        self.message_user(request, f'{synced_count} مدل همگام‌سازی شد.')
    sync_selected_models.short_description = 'همگام‌سازی مدل‌های انتخاب شده'

@admin.register(UserModelPermission)
class UserModelPermissionAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'model', 'is_active', 'custom_rate_limit', 
        'daily_limit', 'monthly_limit', 'granted_at', 'expires_at'
    ]
    list_filter = ['is_active', 'model__tier', 'granted_at']
    search_fields = ['user__email', 'user__username', 'model__display_name']
    raw_id_fields = ['user', 'model']
    
    fieldsets = (
        ('دسترسی', {
            'fields': ('user', 'model', 'is_active')
        }),
        ('محدودیت‌های سفارشی', {
            'fields': ('custom_rate_limit', 'daily_limit', 'monthly_limit')
        }),
        ('زمان‌بندی', {
            'fields': ('granted_at', 'expires_at')
        }),
    )

@admin.register(ModelUsageLog)
class ModelUsageLogAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'model', 'tokens_used', 'success', 
        'request_timestamp', 'response_time_ms'
    ]
    list_filter = [
        'success', 'model__provider', 'model__tier', 'request_timestamp'
    ]
    search_fields = ['user__email', 'model__display_name', 'session_key']
    readonly_fields = ['request_timestamp']
    
    date_hierarchy = 'request_timestamp'
    
    def has_add_permission(self, request):
        return False  # فقط خواندنی
    
    def has_change_permission(self, request, obj=None):
        return False  # فقط خواندنی

# تنظیمات اضافی برای Admin
admin.site.site_header = 'مدیریت مدل‌های هوش مصنوعی'
admin.site.site_title = 'Pyamooz AI Models'
admin.site.index_title = 'پنل مدیریت مدل‌ها'