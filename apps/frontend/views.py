from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import logging

logger = logging.getLogger(__name__)

def home(request):
    """صفحه اصلی اپلیکیشن"""
    context = {
        'page_title': 'SciSpace-like Research Agent',
        'user_name': 'حجت ولایت',
        'user_email': 'h2hojat@gmail.com',
        'user_initial': 'H'
    }
    return render(request, 'index.html', context)

def home_only(request):
    """فقط صفحه اصلی بدون چت"""
    context = {
        'page_title': 'Home - Research Agent',
        'user_name': 'حجت ولایت',
        'user_email': 'h2hojat@gmail.com',
        'user_initial': 'H'
    }
    return render(request, 'frontend/home.html', context)

def chat_view(request):
    """نمای چت"""
    context = {
        'page_title': 'Chat - Research Agent',
        'user_name': 'حجت ولایت',
        'user_email': 'h2hojat@gmail.com',
        'user_initial': 'H'
    }
    return render(request, 'frontend/chat.html', context)

@require_http_methods(["POST"])
def chat_api(request):
    """API برای پردازش پیام‌های چت"""
    try:
        data = json.loads(request.body)
        message = data.get('message', '').strip()
        model = data.get('model', 'gpt 4o')
        deep_search = data.get('deep_search', False)
        
        if not message:
            return JsonResponse({
                'success': False,
                'error': 'پیام نمی‌تواند خالی باشد'
            })
        
        # شبیه‌سازی پردازش
        response_message = f"شما پرسیدید: '{message}'\n\nمن یک ایجنت تحقیقاتی هستم و می‌توانم در موارد زیر کمکتان کنم:\n\n"
        response_message += "• تحقیق و جستجو در منابع علمی\n"
        response_message += "• نوشتن مرور ادبیات\n"
        response_message += "• تولید استناد و منابع\n"
        response_message += "• تحلیل داده‌ها\n"
        response_message += "• خلاصه‌سازی مقالات\n\n"
        
        if deep_search:
            response_message += "🔍 جستجوی عمیق فعال شده است.\n"
        
        response_message += f"🤖 مدل انتخابی: {model}"
        
        return JsonResponse({
            'success': True,
            'message': response_message,
            'model_used': model,
            'deep_search_used': deep_search
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'فرمت JSON نامعتبر است'
        })
    except Exception as e:
        logger.error(f"خطا در chat_api: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': 'خطای داخلی سرور'
        })