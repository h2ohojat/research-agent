from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
import json

User = get_user_model()

class ModelProvider(models.Model):
    """ارائه‌دهندگان مدل (OpenAI, Anthropic, etc.)"""
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.display_name
    
    class Meta:
        db_table = 'model_providers'

class AIModel(models.Model):
    """مدل‌های هوش مصنوعی"""
    
    class ModelTier(models.TextChoices):
        FREE = 'free', 'رایگان'
        BASIC = 'basic', 'پایه'
        PREMIUM = 'premium', 'پریمیوم'
        ENTERPRISE = 'enterprise', 'سازمانی'
    
    # اطلاعات اصلی
    model_id = models.CharField(max_length=200, unique=True)  # از API
    display_name = models.CharField(max_length=200)
    provider = models.ForeignKey(ModelProvider, on_delete=models.CASCADE)
    
    # وضعیت و دسترسی
    is_active = models.BooleanField(default=True)
    tier = models.CharField(max_length=20, choices=ModelTier.choices, default=ModelTier.FREE)
    
    # محدودیت‌ها (از متادیتای API)
    max_requests_per_minute = models.IntegerField(default=60)
    max_tokens_per_minute = models.IntegerField(default=150000)
    max_tokens = models.IntegerField(default=4096)
    max_input_tokens = models.IntegerField(default=4096)
    max_output_tokens = models.IntegerField(default=4096)
    
    # قابلیت‌ها
    supports_vision = models.BooleanField(default=False)
    supports_function_calling = models.BooleanField(default=False)
    supports_tool_choice = models.BooleanField(default=False)
    supports_response_schema = models.BooleanField(default=False)
    
    # قیمت‌گذاری (برای آینده)
    pricing_data = models.JSONField(default=dict, blank=True)
    
    # متادیتای اضافی
    metadata = models.JSONField(default=dict, blank=True)
    
    # زمان‌ها
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.display_name} ({self.provider.name})"
    
    @property
    def is_premium(self):
        return self.tier in [self.ModelTier.PREMIUM, self.ModelTier.ENTERPRISE]
    
    class Meta:
        db_table = 'ai_models'
        ordering = ['provider__name', 'display_name']

class UserModelPermission(models.Model):
    """مجوزهای دسترسی کاربران به مدل‌ها"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE)
    
    # محدودیت‌های شخصی‌سازی شده
    custom_rate_limit = models.IntegerField(null=True, blank=True)
    daily_limit = models.IntegerField(null=True, blank=True)
    monthly_limit = models.IntegerField(null=True, blank=True)
    
    # وضعیت
    is_active = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_model_permissions'
        unique_together = ['user', 'model']

class ModelUsageLog(models.Model):
    """لاگ استفاده از مدل‌ها (برای rate limiting)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=100, null=True, blank=True)  # برای کاربران مهمان
    
    # اطلاعات درخواست
    tokens_used = models.IntegerField(default=0)
    request_timestamp = models.DateTimeField(auto_now_add=True)
    response_time_ms = models.IntegerField(null=True, blank=True)
    
    # وضعیت
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'model_usage_logs'
        indexes = [
            models.Index(fields=['user', 'model', 'request_timestamp']),
            models.Index(fields=['session_key', 'model', 'request_timestamp']),
        ]