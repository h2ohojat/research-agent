import os
from dotenv import load_dotenv
import requests

load_dotenv()
api_key = os.getenv("AVALAI_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

data = {
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "سلام"}],
    "stream": False
}

# تست URL‌های مختلف
urls = [
    "https://api.avalai.ir/chat/completions",
    "https://api.avalai.ir/v1/completions", 
    "https://chat.avalai.ir/api/v1/chat/completions",
    "https://api.avalai.ir/v1/chat/completions",
    "https://avalai.ir/api/v1/chat/completions",
]

for url in urls:
    print(f"\n🔍 Testing: {url}")
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ SUCCESS!")
            break
        else:
            print(f"   ❌ Error: {response.text[:100]}")
    except Exception as e:
        print(f"   ❌ Exception: {str(e)[:100]}")