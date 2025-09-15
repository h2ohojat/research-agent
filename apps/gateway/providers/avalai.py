"""
AvalAI Provider with dynamic parameter handling and enhanced error management
"""
import os
import json
import logging
from typing import Any, Dict, Iterable, List, Optional
import requests
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
    
    def _prepare_avalai_payload(
        self, 
        messages: List[Dict[str, Any]], 
        model: Optional[str] = None, 
        params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Prepare payload specifically for AvalAI API with parameter filtering
        
        Args:
            messages: List of conversation messages
            model: Model identifier
            params: Additional parameters
            
        Returns:
            Filtered payload for AvalAI API
        """
        if params is None:
            params = {}
        
        # Use dynamic parameter preparation from base class
        try:
            # Prepare base request data with parameter filtering
            request_data = self.prepare_request_data(messages, model or self.default_model, params)
            
            logger.info(f"🔧 AvalAI payload prepared successfully")
            logger.debug(f"📋 Final parameters: {list(request_data.keys())}")
            
            return request_data
            
        except Exception as e:
            logger.error(f"❌ Error preparing AvalAI payload: {e}")
            
            # Fallback to minimal safe payload
            fallback_payload = {
                "model": model or self.default_model,
                "messages": messages,
                "stream": params.get("stream", True),
                "temperature": params.get("temperature", 0.7)
            }
            
            logger.warning(f"🔄 Using fallback payload for AvalAI")
            return fallback_payload

    def generate(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        params: Dict[str, Any] | None = None,
        stream: bool = True,
        **kwargs: Any,
    ) -> Iterable[Dict[str, Any]]:
        """
        Generate streaming response from AvalAI API with enhanced error handling
        
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
            # Validate inputs using base class
            if not messages:
                yield self.handle_api_error(ValueError("Messages are required"), "input_validation")
                return
            
            target_model = model or self.default_model
            if not target_model:
                yield self.handle_api_error(ValueError("Model is required"), "input_validation")
                return
            
            # Validate model access
            is_valid, error_msg = self.validate_model_access(target_model)
            if not is_valid:
                yield self.handle_api_error(ValueError(error_msg), "model_validation")
                return
            
            # Merge params and kwargs
            all_params = params.copy() if params else {}
            all_params.update(kwargs)
            all_params['stream'] = stream
            
            # Prepare payload with parameter filtering
            try:
                payload = self._prepare_avalai_payload(messages, target_model, all_params)
            except Exception as e:
                yield self.handle_api_error(e, "payload_preparation")
                return
            
            # API endpoint
            url = f"{self.base_url}/chat/completions"
            
            logger.info(f"🚀 Starting AvalAI request")
            logger.info(f"📍 URL: {url}")
            logger.info(f"🤖 Model: {payload.get('model')}")
            logger.info(f"🌊 Stream: {payload.get('stream')}")
            logger.debug(f"📦 Payload keys: {list(payload.keys())}")
            
            # Emit started event
            yield self.create_event("started", model=payload.get("model"), provider=self.name)
            
            # Make request
            with requests.post(
                url,
                headers=self._headers(),
                json=payload,
                stream=True,
                timeout=(10, 300),
            ) as response:
                
                logger.info(f"📡 AvalAI response status: {response.status_code}")
                
                # Handle non-200 responses
                if response.status_code != 200:
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    
                    logger.error(f"❌ AvalAI API error {response.status_code}: {error_message}")
                    
                    # Yield formatted error
                    yield self.create_event("token", delta=f"❌ Error: {error_message}", seq=0)
                    yield self.create_event("done", finish_reason="error")
                    return
                
                # Process streaming response
                seq = 0
                line_count = 0
                total_content = ""
                
                logger.debug(f"🔄 Processing AvalAI stream...")
                
                for raw_line in response.iter_lines(decode_unicode=True):
                    line_count += 1
                    
                    if not raw_line or raw_line.isspace():
                        continue
                    
                    # Parse SSE format
                    if raw_line.startswith("data: "):
                        data_str = raw_line[6:].strip()
                    else:
                        data_str = raw_line.strip()
                    
                    # Check for stream end
                    if data_str == "[DONE]":
                        logger.info(f"✅ AvalAI stream completed normally")
                        break
                    
                    # Parse JSON chunk
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError as e:
                        logger.warning(f"⚠️ Failed to parse AvalAI JSON: {e}")
                        continue
                    
                    # Process chunk
                    choices = chunk.get("choices", [])
                    if not choices:
                        continue
                    
                    choice = choices[0]
                    delta = choice.get("delta", {})
                    content = delta.get("content")
                    
                    # Yield content token
                    if content:
                        total_content += content
                        logger.debug(f"📝 AvalAI token: {repr(content[:50])}")
                        yield self.create_event("token", delta=content, seq=seq)
                        seq += 1
                    
                    # Check for finish
                    finish_reason = choice.get("finish_reason")
                    if finish_reason:
                        logger.info(f"🏁 AvalAI finished: {finish_reason}")
                        yield self.create_event("done", finish_reason=finish_reason)
                        return
                
                # Ensure stream ends properly
                logger.info(f"✅ AvalAI stream ended normally, total tokens: {seq}")
                yield self.create_event("done", finish_reason="stop")
                
        except requests.exceptions.Timeout as e:
            logger.error(f"⏱️ AvalAI timeout: {e}")
            yield self.handle_api_error(e, "request_timeout")
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"🔌 AvalAI connection error: {e}")
            yield self.handle_api_error(e, "connection_error")
            
        except requests.exceptions.RequestException as e:
            logger.error(f"📡 AvalAI request error: {e}")
            yield self.handle_api_error(e, "request_error")
            
        except Exception as e:
            logger.error(f"💥 Unexpected AvalAI error: {e}")
            logger.exception("Full traceback:")
            yield self.handle_api_error(e, "unexpected_error")
    
    def get_supported_models(self) -> List[str]:
        """
        Get list of supported models for AvalAI
        This could be expanded to make an API call to get available models
        
        Returns:
            List of supported model identifiers
        """
        # This could be made dynamic by calling AvalAI's models endpoint
        return [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4",
            "gpt-3.5-turbo",
            # Add more models as they become available
        ]
    
    def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to AvalAI API
        
        Returns:
            Tuple of (is_connected, message)
        """
        try:
            # Simple test request
            test_url = f"{self.base_url}/models"  # If available
            
            response = requests.get(
                test_url,
                headers=self._headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                return True, "AvalAI connection successful"
            else:
                return False, f"AvalAI returned status {response.status_code}"
                
        except Exception as e:
            return False, f"AvalAI connection failed: {str(e)}"
    
    def __str__(self) -> str:
        """String representation of AvalAI provider"""
        return f"AvalaiProvider(model={self.default_model}, region={self.region})"
    
    def __repr__(self) -> str:
        """Detailed string representation"""
        return (f"AvalaiProvider(name='{self.name}', "
                f"base_url='{self.base_url}', "
                f"default_model='{self.default_model}', "
                f"region='{self.region}')")
    
    

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
