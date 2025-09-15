# فایل test_stream.py
import requests
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("AVALAI_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# تست streaming
data = {
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "سلام"}],
    "stream": True  # ← streaming
}

response = requests.post(
    "https://api.avalai.ir/v1/chat/completions",
    headers=headers,
    json=data,
    stream=True
)

print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")