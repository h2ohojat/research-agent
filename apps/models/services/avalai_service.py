import requests
import logging
from typing import List, Dict, Optional
from django.conf import settings
from django.core.cache import cache
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AvalAIService:
    """سرویس ارتباط با AvalAI API"""
    
    def __init__(self):
        self.api_url = getattr(settings, 'MODEL_SETTINGS', {}).get(
            'AVALAI_API_URL', 
            'https://api.avalai.ir/public/models'
        )
        self.cache_timeout = getattr(settings, 'MODEL_SETTINGS', {}).get(
            'CACHE_TIMEOUT', 
            300
        )
        self.cache_key = 'avalai_models_list'
    
    def fetch_models(self, force_refresh: bool = False) -> List[Dict]:
        """
        دریافت لیست مدل‌ها از AvalAI
        
        Args:
            force_refresh: اجبار به دریافت جدید (نادیده گرفتن کش)
            
        Returns:
            List[Dict]: لیست مدل‌ها
        """
        # چک کردن کش
        if not force_refresh:
            cached_models = cache.get(self.cache_key)
            if cached_models:
                logger.info("📋 Models loaded from cache")
                return cached_models
        
        try:
            logger.info("🔍 Fetching models from AvalAI API...")
            
            response = requests.get(
                self.api_url,
                timeout=30,
                headers={
                    'User-Agent': 'Pyamooz-AI/1.0',
                    'Accept': 'application/json'
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            if data.get('object') == 'list' and 'data' in data:
                models = data['data']
                
                # ذخیره در کش
                cache.set(self.cache_key, models, self.cache_timeout)
                
                logger.info(f"✅ Successfully fetched {len(models)} models from AvalAI")
                return models
            else:
                logger.error("❌ Invalid response format from AvalAI API")
                return []
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error fetching models from AvalAI: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            return []
    
    def get_model_by_id(self, model_id: str) -> Optional[Dict]:
        """
        دریافت اطلاعات یک مدل خاص
        
        Args:
            model_id: شناسه مدل
            
        Returns:
            Dict یا None: اطلاعات مدل
        """
        models = self.fetch_models()
        
        for model in models:
            if model.get('id') == model_id:
                return model
        
        return None
    
    def get_models_by_provider(self, provider: str) -> List[Dict]:
        """
        دریافت مدل‌های یک ارائه‌دهنده خاص
        
        Args:
            provider: نام ارائه‌دهنده
            
        Returns:
            List[Dict]: لیست مدل‌های ارائه‌دهنده
        """
        models = self.fetch_models()
        
        return [
            model for model in models 
            if model.get('owned_by', '').lower() == provider.lower()
        ]
    
    def get_free_models(self) -> List[Dict]:
        """
        دریافت مدل‌های رایگان (بر اساس تنظیمات)
        
        Returns:
            List[Dict]: لیست مدل‌های رایگان
        """
        models = self.fetch_models()
        default_guest_models = getattr(settings, 'MODEL_SETTINGS', {}).get(
            'DEFAULT_GUEST_MODELS', 
            ['gpt-3.5-turbo', 'gpt-4o-mini']
        )
        
        free_models = []
        for model in models:
            model_id = model.get('id', '')
            # چک کردن اینکه مدل در لیست رایگان باشد یا min_tier کم باشد
            if (model_id in default_guest_models or 
                model.get('min_tier', 0) == 0):
                free_models.append(model)
        
        return free_models
    
    def clear_cache(self):
        """پاک کردن کش مدل‌ها"""
        cache.delete(self.cache_key)
        logger.info("🗑️ AvalAI models cache cleared")

# Instance سراسری
avalai_service = AvalAIService()