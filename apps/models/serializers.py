from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AIModel, ModelProvider, UserModelPermission

User = get_user_model()

class ModelProviderSerializer(serializers.ModelSerializer):
    """سریالایزر برای ارائه‌دهندگان مدل"""
    
    class Meta:
        model = ModelProvider
        fields = ['id', 'name', 'display_name', 'is_active']

class AIModelListSerializer(serializers.ModelSerializer):
    """سریالایزر برای لیست مدل‌ها (خلاصه)"""
    provider = ModelProviderSerializer(read_only=True)
    
    class Meta:
        model = AIModel
        fields = [
            'id', 'model_id', 'display_name', 'provider', 'tier',
            'supports_vision', 'supports_function_calling', 
            'supports_tool_choice', 'supports_response_schema'
        ]

class AIModelDetailSerializer(serializers.ModelSerializer):
    """سریالایزر تفصیلی برای مدل‌ها"""
    provider = ModelProviderSerializer(read_only=True)
    
    class Meta:
        model = AIModel
        fields = [
            'id', 'model_id', 'display_name', 'provider', 'tier',
            'max_requests_per_minute', 'max_tokens_per_minute',
            'max_tokens', 'max_input_tokens', 'max_output_tokens',
            'supports_vision', 'supports_function_calling',
            'supports_tool_choice', 'supports_response_schema',
            'pricing_data', 'created_at', 'updated_at', 'last_synced'
        ]

class UserModelSelectionSerializer(serializers.Serializer):
    """سریالایزر برای انتخاب مدل کاربر"""
    model_id = serializers.CharField(max_length=200)
    
    def validate_model_id(self, value):
        """اعتبارسنجی model_id"""
        try:
            model = AIModel.objects.get(model_id=value, is_active=True)
        except AIModel.DoesNotExist:
            raise serializers.ValidationError("مدل یافت نشد یا غیرفعال است.")
        
        # بررسی دسترسی کاربر
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            from .services.model_manager import model_manager
            if not model_manager.check_user_model_access(request.user, value):
                raise serializers.ValidationError("شما به این مدل دسترسی ندارید.")
        
        return value

class ModelStatsSerializer(serializers.Serializer):
    """سریالایزر برای آمار مدل‌ها"""
    total_models = serializers.IntegerField()
    free_models = serializers.IntegerField()
    premium_models = serializers.IntegerField()
    user_accessible_models = serializers.IntegerField()
    providers_count = serializers.IntegerField()