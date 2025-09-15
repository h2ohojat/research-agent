import os
from dotenv import load_dotenv
import requests

# Load .env
load_dotenv()

api_key = os.getenv("AVALAI_API_KEY")
print(f"API Key: {api_key[:10]}...{api_key[-5:]}")
print(f"Length: {len(api_key)}")

# Test request
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

data = {
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "سلام"}],
    "stream": False
}

response = requests.post(
    "https://api.avalai.ir/v1/chat/completions",
    headers=headers,
    json=data
)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("✅ API works!")
    print(response.json())
else:
    print("❌ Error:")
    print(response.text)