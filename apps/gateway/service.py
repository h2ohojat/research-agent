import os
from .providers.fake import FakeProvider
from .providers.avalai import AvalaiProvider  

# در آینده این رجیستری به چند Provider گسترش می‌یابد
REGISTRY = {
    "fake": FakeProvider,
    "avalai": AvalaiProvider  
    # "openai": OpenAIProvider  (بعداً)
}

def get_provider(name: str | None = None):
    name = os.getenv("DEFAULT_PROVIDER", "fake").lower()
    cls = REGISTRY.get(name, FakeProvider)
    return cls()
