"""
AvalAI Provider with dynamic parameter handling and enhanced error management
"""
import os
import json
import logging
from typing import Any, Dict, AsyncIterable, List, Optional  # <--- تغییر: Iterable به AsyncIterable
import httpx  # <--- تغییر: جایگزینی requests با httpx
from .base import BaseProvider

logger = logging.getLogger(__name__)

class AvalaiProvider(BaseProvider):
    """
    AvalAI provider with automatic parameter filtering and robust error handling
    """
    
    name = "avalai"
    region = "ir"
    
    def __init__(self) -> None:
        """Initialize AvalAI provider with configuration"""
        # Initialize base provider first
        super().__init__()
        
        # AvalAI specific configuration
        self.base_url = os.getenv("AVALAI_BASE_URL", "https://api.avalai.ir/v1").rstrip("/")
        self.api_key = os.getenv("AVALAI_API_KEY")
        self.default_model = os.getenv("AVALAI_MODEL", "gpt-4o-mini")
        
        if not self.api_key:
            raise RuntimeError("❌ AVALAI_API_KEY is not set")
        
        logger.info(f"✅ AvalAI provider initialized with base URL: {self.base_url}")
        logger.info(f"🎯 Default model: {self.default_model}")
        logger.debug(f"🔧 Parameter handler initialized for {self.name}")

    def _headers(self) -> Dict[str, str]:
        """Generate headers for AvalAI API requests"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
    
    def validate_model_access(self, model: str) -> tuple[bool, str]:
        """
        Validate if the model is accessible for AvalAI
        
        Args:
            model: Model identifier
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not model:
            return False, "Model identifier is required"
        
        # Add AvalAI specific model validation if needed
        # For now, assume all models are potentially valid
        return True, "Model validation passed"
    
    # --- این متد بدون تغییر باقی می‌ماند ---
    def _prepare_avalai_payload(
        self, 
        messages: List[Dict[str, Any]], 
        model: Optional[str] = None, 
        params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Prepare payload specifically for AvalAI API with parameter filtering.
        - ابتدا از مسیر استاندارد (BaseProvider + ParameterHandler) استفاده می‌کنیم.
        - اگر هر دلیلی آماده‌سازی شکست خورد، به یک fallback «ایمن» برمی‌گردیم
        که فقط کلیدهای سازگار و عمومی را می‌فرستد.
        """
        if params is None:
            params = {}

        try:
            # مسیر استاندارد: فیلتر/مپ/دیفالت‌ها طبق provider+model
            request_data = self.prepare_request_data(
                messages=messages,
                model=model or self.default_model,
                **params
            )
            logger.info("🔧 AvalAI payload prepared successfully")
            logger.debug("📋 Final parameters: %s", list(request_data.keys()))
            return request_data

        except Exception as e:
            logger.error("❌ Error preparing AvalAI payload: %s", e)

            # ⚠️ Fallback ایمن: فقط فیلدهای عمومی/سازگار را نگه می‌داریم.
            # عمداً temperature/top_p/... را وارد نمی‌کنیم تا مدل‌های preview خطا ندهند.
            fallback_payload = {
                "model": model or self.default_model,
                "messages": messages,
                "stream": bool(params.get("stream", True)),
            }
            # اگر max_tokens به‌صورت واضح آمده بود، همان را پاس بده (عمومی و ایمن است)
            if "max_tokens" in params:
                try:
                    # تبدیل نرم به عدد
                    fallback_payload["max_tokens"] = int(float(params["max_tokens"]))
                except Exception:
                    pass

            logger.warning("🔄 Using minimal safe fallback payload for AvalAI")
            return fallback_payload

    # --- تغییر اصلی در این متد است: تبدیل به async و استفاده از httpx ---
    async def generate(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        params: Dict[str, Any] | None = None,
        stream: bool = True,
        **kwargs: Any,
    ) -> AsyncIterable[Dict[str, Any]]:
        """
        Generate ASYNCHRONOUS streaming response from AvalAI API with enhanced error handling
        
        Args:
            messages: List of conversation messages
            model: Model identifier
            params: Additional parameters
            stream: Whether to use streaming
            **kwargs: Additional keyword arguments
            
        Yields:
            Event dictionaries with type, data, etc.
        """
        try:
            # بخش اعتبارسنجی و آماده‌سازی payload کاملاً بدون تغییر باقی می‌ماند
            if not messages:
                yield self.handle_api_error(ValueError("Messages are required"), "input_validation")
                return
            
            target_model = model or self.default_model
            if not target_model:
                yield self.handle_api_error(ValueError("Model is required"), "input_validation")
                return
            
            is_valid, error_msg = self.validate_model_access(target_model)
            if not is_valid:
                yield self.handle_api_error(ValueError(error_msg), "model_validation")
                return
            
            all_params = params.copy() if params else {}
            all_params.update(kwargs)
            all_params['stream'] = stream
            
            try:
                payload = self._prepare_avalai_payload(messages, target_model, all_params)
            except Exception as e:
                yield self.handle_api_error(e, "payload_preparation")
                return
            
            url = f"{self.base_url}/chat/completions"
            
            logger.info(f"🚀 Starting AvalAI request")
            logger.info(f"📍 URL: {url}")
            logger.info(f"🤖 Model: {payload.get('model')}")
            logger.info(f"🌊 Stream: {payload.get('stream')}")
            logger.debug(f"📦 Payload keys: {list(payload.keys())}")
            
            yield self.create_event("started", model=payload.get("model"), provider=self.name)
            
            # --- شروع بلوک کد جایگزین شده با httpx ---
            async with httpx.AsyncClient(timeout=(10, 300)) as client:
                async with client.stream("POST", url, headers=self._headers(), json=payload) as response:
                    
                    logger.info(f"📡 AvalAI response status: {response.status_code}")
                    
                    if response.status_code != 200:
                        error_body = await response.aread()
                        try:
                            error_data = json.loads(error_body)
                            error_message = error_data.get('error', {}).get('message', error_body.decode(errors='ignore'))
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            error_message = error_body.decode(errors='ignore')
                        
                        logger.error(f"❌ AvalAI API error {response.status_code}: {error_message}")
                        yield self.create_event("token", delta=f"❌ Error: {error_message}", seq=0)
                        yield self.create_event("done", finish_reason="error")
                        return
                    
                    seq = 0
                    total_content = "" # این متغیرها از کد اصلی شما حفظ شده‌اند
                    line_count = 0
                    
                    logger.debug(f"🔄 Processing AvalAI stream...")
                    
                    async for raw_line in response.aiter_lines():
                        line_count += 1
                        
                        if not raw_line or raw_line.isspace():
                            continue
                        
                        if raw_line.startswith("data: "):
                            data_str = raw_line[6:].strip()
                        else:
                            data_str = raw_line.strip()
                        
                        if data_str == "[DONE]":
                            logger.info(f"✅ AvalAI stream completed normally")
                            break
                        
                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError as e:
                            logger.warning(f"⚠️ Failed to parse AvalAI JSON: {e} on line: '{data_str}'")
                            continue
                        
                        choices = chunk.get("choices", [])
                        if not choices:
                            continue
                        
                        choice = choices[0]
                        delta = choice.get("delta", {})
                        content = delta.get("content")
                        
                        if content:
                            total_content += content
                            logger.debug(f"📝 AvalAI token: {repr(content[:50])}")
                            yield self.create_event("token", delta=content, seq=seq)
                            seq += 1
                        
                        finish_reason = choice.get("finish_reason")
                        if finish_reason:
                            logger.info(f"🏁 AvalAI finished: {finish_reason}")
                            yield self.create_event("done", finish_reason=finish_reason)
                            return
                
                logger.info(f"✅ AvalAI stream ended normally, total tokens: {seq}")
                yield self.create_event("done", finish_reason="stop")
        
        # --- بخش مدیریت خطا با خطاهای httpx به‌روزرسانی شده است ---
        except httpx.TimeoutException as e:
            logger.error(f"⏱️ AvalAI timeout: {e}")
            yield self.handle_api_error(e, "request_timeout")
        except httpx.ConnectError as e:
            logger.error(f"🔌 AvalAI connection error: {e}")
            yield self.handle_api_error(e, "connection_error")
        except httpx.RequestError as e:
            logger.error(f"📡 AvalAI request error: {e}")
            yield self.handle_api_error(e, "request_error")
        except Exception as e:
            logger.error(f"💥 Unexpected AvalAI error: {e}")
            logger.exception("Full traceback:")
            yield self.handle_api_error(e, "unexpected_error")

    # --- این متد بدون تغییر باقی می‌ماند ---
    def get_supported_models(self) -> List[str]:
        """
        Get list of supported models for AvalAI
        This could be expanded to make an API call to get available models
        
        Returns:
            List of supported model identifiers
        """
        return [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4",
            "gpt-3.5-turbo",
        ]

    # --- این متد برای سازگاری با محیط ناهمگام بهتر است async شود ---
    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to AvalAI API asynchronously.
        
        Returns:
            Tuple of (is_connected, message)
        """
        try:
            test_url = f"{self.base_url}/models"
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, headers=self._headers(), timeout=10)
            
            if response.status_code == 200:
                return True, "AvalAI connection successful"
            else:
                return False, f"AvalAI returned status {response.status_code}"
                
        except Exception as e:
            return False, f"AvalAI connection failed: {str(e)}"

    # --- این متدها بدون تغییر باقی می‌مانند ---
    def __str__(self) -> str:
        """String representation of AvalAI provider"""
        return f"AvalaiProvider(model={self.default_model}, region={self.region})"
    
    def __repr__(self) -> str:
        """Detailed string representation"""
        return (f"AvalaiProvider(name='{self.name}', "
                f"base_url='{self.base_url}', "
                f"default_model='{self.default_model}', "
                f"region='{self.region}')")