# 1. استفاده از ایمیج سبک پایتون (slim) برای کاهش حجم نهایی
FROM python:3.11-slim

# 2. تنظیم متغیرهای محیطی برای بهینه‌سازی پایتون در داکر
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 3. مسیر کاری
WORKDIR /usr/src/app

# 4. کپی فایل وابستگی‌ها و نصب پکیج‌ها (بهینه شده برای کش داکر)
# با این روش، اگر فقط کد شما تغییر کند و پکیج‌ها ثابت بمانند،
# لایه نصب پکیج‌ها دوباره ساخته نمی‌شود و بیلد بسیار سریع‌تر خواهد بود.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5. کپی کل کد پروژه
COPY . .

# 6. جمع‌آوری فایل‌های استاتیک در زمان ساخت (Build Time)
# این کار سرعت راه‌اندازی برنامه را افزایش می‌دهد.
RUN python manage.py collectstatic --noinput --clear

# 7. Expose کردن پورت برای اطلاع‌رسانی به داکر
EXPOSE 8000

# 8. اجرای Daphne به عنوان سرور اصلی
# استفاده از --bind و --port استانداردتر است.
CMD ["daphne", "--bind", "0.0.0.0", "--port", "8000", "pyamooz_ai.asgi:application"]