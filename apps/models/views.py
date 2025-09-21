import logging  # <<<<<<<<<<<<<<< [جدید] ایمپورت لاگر
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from .models import AIModel, ModelProvider
from .serializers import (
    AIModelListSerializer, AIModelDetailSerializer, 
    ModelProviderSerializer, UserModelSelectionSerializer,
    ModelStatsSerializer
)
from .services.model_manager import model_manager
from .services.avalai_service import avalai_service

User = get_user_model()
logger = logging.getLogger(__name__) # <<<<<<<<<<<<<<< [جدید] تعریف لاگر

class ModelListView(generics.ListAPIView):
    """لیست مدل‌های قابل دسترس برای کاربر"""
    serializer_class = AIModelListSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """
        این متد برای دریافت لیست مدل‌ها بهینه شده است.
        1. ابتدا مدل‌های موجود را با بهینه‌سازی کوئری (select_related) دریافت می‌کند.
        2. اگر هیچ مدلی یافت نشد (Lazy Refresh)، یک همگام‌سازی فوری و همزمان (synchronous) انجام می‌دهد.
        3. در نهایت، لیست به‌روز شده را برمی‌گرداند.
        """
        user = self.request.user if self.request.user.is_authenticated else None
        
        # بهینه‌سازی برای جلوگیری از N+1 Query هنگام سریالایز کردن provider
        queryset = model_manager.get_available_models_for_user(user).select_related('provider')
        
        # <<<<<<<<<<<<<<< [منطق جدید] Lazy Refresh در اینجا شروع می‌شود >>>>>>>>>>>>>>>
        if not queryset.exists():
            logger.warning("Model list is empty. Triggering an immediate lazy refresh from AvalAI...")
            try:
                # یک همگام‌سازی فوری انجام می‌دهیم تا این درخواست کاربر بی‌پاسخ نماند
                model_manager.sync_models_from_avalai(force_refresh=True)
                
                # پس از همگام‌سازی، کوئری را مجدداً اجرا می‌کنیم
                queryset = model_manager.get_available_models_for_user(user).select_related('provider')
                logger.info("✅ Lazy refresh completed. Models are now populated.")
            except Exception as e:
                # اگر همگام‌سازی با خطا مواجه شد، لاگ می‌کنیم و یک کوئری ست خالی برمی‌گردانیم تا برنامه کرش نکند
                logger.error(f"❌ Lazy refresh failed during API call: {str(e)}")
        # <<<<<<<<<<<<<<< [منطق جدید] پایان Lazy Refresh >>>>>>>>>>>>>>>
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # فیلتر بر اساس tier
        tier = request.query_params.get('tier')
        if tier:
            queryset = queryset.filter(tier=tier)
        
        # فیلتر بر اساس provider
        provider = request.query_params.get('provider')
        if provider:
            queryset = queryset.filter(provider__name=provider)
        
        # فیلتر بر اساس قابلیت‌ها
        if request.query_params.get('vision') == 'true':
            queryset = queryset.filter(supports_vision=True)
        
        if request.query_params.get('function_calling') == 'true':
            queryset = queryset.filter(supports_function_calling=True)
        
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'success': True,
            'count': len(serializer.data),
            'models': serializer.data,
            'user_authenticated': request.user.is_authenticated,
            'user_tier': 'admin' if request.user.is_authenticated and request.user.is_superuser else 'guest'
        })

class ModelDetailView(generics.RetrieveAPIView):
    """جزئیات یک مدل خاص"""
    serializer_class = AIModelDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = 'model_id'
    
    def get_queryset(self):
        user = self.request.user if self.request.user.is_authenticated else None
        # <<<<<<<<<<<<<<< [بهینه‌سازی] افزودن select_related برای جزئیات مدل >>>>>>>>>>>>>>>
        return model_manager.get_available_models_for_user(user).select_related('provider')
    
    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            
            # بررسی دسترسی کاربر
            has_access = model_manager.check_user_model_access(
                request.user if request.user.is_authenticated else None,
                instance.model_id
            )
            
            return Response({
                'success': True,
                'model': serializer.data,
                'user_has_access': has_access
            })
        except: # تغییر برای پوشش موارد بیشتر مانند نبود مدل پس از Lazy Refresh
            return Response({
                'success': False,
                'error': 'مدل یافت نشد یا به آن دسترسی ندارید.'
            }, status=status.HTTP_404_NOT_FOUND)

@method_decorator(cache_page(60 * 5), name='get')  # کش 5 دقیقه‌ای
class ProviderListView(generics.ListAPIView):
    """لیست ارائه‌دهندگان مدل"""
    queryset = ModelProvider.objects.filter(is_active=True)
    serializer_class = ModelProviderSerializer
    permission_classes = [AllowAny]

@api_view(['POST'])
@permission_classes([AllowAny])
def select_model(request):
    """انتخاب مدل توسط کاربر"""
    serializer = UserModelSelectionSerializer(
        data=request.data, 
        context={'request': request}
    )
    
    if serializer.is_valid():
        model_id = serializer.validated_data['model_id']
        
        # ذخیره انتخاب کاربر در session
        request.session['selected_model'] = model_id
        
        # اگر کاربر لاگین باشد، در profile ذخیره کن
        if request.user.is_authenticated:
            # TODO: اضافه کردن فیلد preferred_model به User model
            pass
        
        # دریافت اطلاعات مدل
        try:
            model = AIModel.objects.get(model_id=model_id, is_active=True)
            model_data = AIModelListSerializer(model).data
            
            return Response({
                'success': True,
                'message': f'مدل {model.display_name} انتخاب شد.',
                'selected_model': model_data
            })
        except AIModel.DoesNotExist:
            return Response({
                'success': False,
                'error': 'مدل یافت نشد.'
            }, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_selected_model(request):
    """دریافت مدل انتخاب شده کاربر"""
    # ابتدا از session بخوان
    selected_model_id = request.session.get('selected_model')
    
    # اگر کاربر لاگین باشد و مدلی انتخاب نکرده، مدل پیش‌فرض را بده
    if not selected_model_id and request.user.is_authenticated:
        # TODO: از user profile بخوان
        pass
    
    # اگر هنوز مدلی نیست، اولین مدل رایگان را بده
    if not selected_model_id:
        free_models = model_manager.get_available_models_for_user(None)
        if free_models.exists(): # <<<<<<<<<<<<<<< [بهینه‌سازی] استفاده از exists
            selected_model_id = free_models.first().model_id
            request.session['selected_model'] = selected_model_id
    
    if selected_model_id:
        try:
            model = AIModel.objects.get(model_id=selected_model_id, is_active=True)
            
            # بررسی دسترسی
            has_access = model_manager.check_user_model_access(
                request.user if request.user.is_authenticated else None,
                selected_model_id
            )
            
            if has_access:
                model_data = AIModelListSerializer(model).data
                return Response({
                    'success': True,
                    'selected_model': model_data
                })
            else:
                # اگر دسترسی نداشت، مدل را پاک کن و مدل رایگان بده
                request.session.pop('selected_model', None)
                return get_selected_model(request)  # تکرار برای گرفتن مدل جدید
                
        except AIModel.DoesNotExist:
            request.session.pop('selected_model', None)
    
    # اگر هیچ مدلی پیدا نشد، یک پاسخ مناسب برگردان
    return Response({
        'success': False,
        'error': 'هیچ مدل در دسترسی یافت نشد.'
    }, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([AllowAny])
def model_stats(request):
    """آمار کلی مدل‌ها"""
    cache_key = 'model_stats'
    cached_stats = cache.get(cache_key)
    
    if cached_stats:
        return Response(cached_stats)
    
    # محاسبه آمار
    all_active_models = AIModel.objects.filter(is_active=True)
    total_models = all_active_models.count()
    free_models = all_active_models.filter(tier='free').count()
    premium_models = total_models - free_models
    providers_count = ModelProvider.objects.filter(is_active=True).count()
    
    user = request.user if request.user.is_authenticated else None
    user_accessible_models = model_manager.get_available_models_for_user(user).count() # <<<<<<<<<<<<< [بهینه‌سازی]
    
    stats_data = {
        'success': True,
        'stats': {
            'total_models': total_models,
            'free_models': free_models,
            'premium_models': premium_models,
            'user_accessible_models': user_accessible_models,
            'providers_count': providers_count
        }
    }
    
    # کش برای 10 دقیقه
    cache.set(cache_key, stats_data, 600)
    
    return Response(stats_data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_models(request):
    """همگام‌سازی دستی مدل‌ها (فقط برای ادمین)"""
    if not request.user.is_superuser:
        return Response({
            'success': False,
            'error': 'دسترسی محدود به ادمین'
        }, status=status.HTTP_403_FORBIDDEN)
    
    force_refresh = request.data.get('force_refresh', False)
    
    try:
        result = model_manager.sync_models_from_avalai(force_refresh)
        
        # پاک کردن کش‌های مربوطه
        cache.delete('model_stats')
        
        return Response({
            'success': True,
            'message': 'همگام‌سازی با موفقیت انجام شد',
            'result': result
        })
    except Exception as e:
        return Response({
            'success': False,
            'error': f'خطا در همگام‌سازی: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)