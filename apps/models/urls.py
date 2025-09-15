from django.urls import path
from . import views

app_name = 'models'

urlpatterns = [
    # لیست و جزئیات مدل‌ها
    path('models/', views.ModelListView.as_view(), name='model-list'),
    path('models/<str:model_id>/', views.ModelDetailView.as_view(), name='model-detail'),
    
    # ارائه‌دهندگان
    path('providers/', views.ProviderListView.as_view(), name='provider-list'),
    
    # انتخاب مدل
    path('select-model/', views.select_model, name='select-model'),
    path('selected-model/', views.get_selected_model, name='get-selected-model'),
    
    # آمار
    path('stats/', views.model_stats, name='model-stats'),
    
    # مدیریت (ادمین)
    path('sync/', views.sync_models, name='sync-models'),
]