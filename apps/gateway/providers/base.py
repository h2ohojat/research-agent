"""
Base provider with dynamic parameter handling
Enhanced version compatible with existing architecture
"""
import logging
from typing import Iterable, Dict, Any, List, Optional
from ..utils.parameter_handler import ParameterHandler

logger = logging.getLogger(__name__)

class BaseProvider:
    """
    Base class for all AI providers with dynamic parameter handling
    Compatible with existing generator-based architecture
    """
    
    name: str = "base"
    region: str = "ir"  # در آینده برای روتینگ صف کاربرد دارد
    
    def __init__(self, api_key: Optional[str] = None, **kwargs):
        """
        Initialize provider with dynamic parameter handling
        
        Args:
            api_key: API key for the provider
            **kwargs: Additional provider-specific configuration
        """
        self.api_key = api_key
        self.config = kwargs
        
        # Initialize parameter handler based on provider name
        self.param_handler = ParameterHandler(self.name)
        
        logger.info(f"Initialized {self.name} provider with dynamic parameter handling")
        logger.debug(f"Provider config: {self.config}")
    
    def prepare_request_data(self, messages: List[Dict[str, str]], model: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Prepare request data using dynamic parameter handling
        
        Args:
            messages: List of conversation messages
            model: Model identifier
            params: Additional parameters
            
        Returns:
            Dict with filtered and mapped parameters for this provider
        """
        if params is None:
            params = {}
        
        logger.debug(f"Preparing request data for {self.name} provider")
        logger.debug(f"Input parameters: {list(params.keys())}")
        
        try:
            # Use parameter handler to prepare data
            request_data = self.param_handler.prepare_request_data(
                messages=messages,
                model=model,
                **params
            )
            
            # Validate the prepared data
            is_valid, error_msg = self.param_handler.validate_request_data(request_data)
            if not is_valid:
                logger.error(f"Invalid request data for {self.name}: {error_msg}")
                raise ValueError(f"Invalid request data for {self.name}: {error_msg}")
            
            logger.info(f"Successfully prepared request data for {self.name}")
            logger.debug(f"Final parameters: {list(request_data.keys())}")
            
            return request_data
            
        except Exception as e:
            logger.error(f"Error preparing request data for {self.name}: {e}")
            # Fallback to basic parameters
            return {
                'model': model,
                'messages': messages,
                'stream': params.get('stream', True),
                'temperature': params.get('temperature', 0.7)
            }
    
    def filter_unsupported_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Filter out parameters that are not supported by this provider
        
        Args:
            params: Input parameters dictionary
            
        Returns:
            Filtered parameters dictionary
        """
        if not hasattr(self, 'param_handler'):
            logger.warning(f"Parameter handler not initialized for {self.name}, returning original params")
            return params
        
        filtered_params = {}
        unsupported_params = []
        
        for param_name, param_value in params.items():
            if param_value is None:
                continue
                
            # Check if parameter is supported
            if self.param_handler.is_parameter_supported(param_name):
                # Map parameter name if needed
                mapped_name, mapped_value = self.param_handler.map_parameter(param_name, param_value)
                filtered_params[mapped_name] = mapped_value
            else:
                unsupported_params.append(param_name)
        
        if unsupported_params:
            logger.info(f"Filtered unsupported parameters for {self.name}: {unsupported_params}")
        
        return filtered_params
    
    def supports_streaming(self) -> bool:
        """Check if provider supports streaming"""
        if hasattr(self, 'param_handler'):
            return self.param_handler.supports_feature('streaming')
        return True  # Default assumption
    
    def supports_usage_tracking(self) -> bool:
        """Check if provider supports usage tracking"""
        if hasattr(self, 'param_handler'):
            return self.param_handler.supports_feature('usage_tracking')
        return False  # Conservative default
    
    def get_default_parameters(self) -> Dict[str, Any]:
        """Get default parameters for this provider"""
        if hasattr(self, 'param_handler'):
            return self.param_handler.config.get('default_parameters', {})
        
        # Fallback defaults
        return {
            'temperature': 0.7,
            'stream': True
        }
    
    def validate_model_access(self, model: str) -> tuple[bool, str]:
        """
        Validate if the model is accessible for this provider
        
        Args:
            model: Model identifier
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Base implementation - can be overridden by subclasses
        if not model:
            return False, "Model identifier is required"
        
        return True, "Model validation passed"
    
    def handle_api_error(self, error: Exception, context: str = "") -> Dict[str, Any]:
        """
        Handle and format API errors consistently
        
        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred
            
        Returns:
            Formatted error event dictionary
        """
        error_message = str(error)
        
        # Categorize common errors
        if "insufficient_tier" in error_message.lower() or "access" in error_message.lower():
            error_type = "ACCESS_DENIED"
            user_message = f"مدل انتخاب شده برای سطح کاربری شما قابل دسترس نیست"
        elif "parameter" in error_message.lower() and "unknown" in error_message.lower():
            error_type = "INVALID_PARAMETER"
            user_message = f"پارامتر نامعتبر برای {self.name}"
        elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
            error_type = "RATE_LIMIT"
            user_message = "محدودیت تعداد درخواست. لطفاً کمی صبر کنید"
        elif "timeout" in error_message.lower():
            error_type = "TIMEOUT"
            user_message = "زمان انتظار تمام شد. لطفاً دوباره تلاش کنید"
        else:
            error_type = "UNKNOWN_ERROR"
            user_message = f"خطا در ارتباط با {self.name}"
        
        logger.error(f"{self.name} {context} error [{error_type}]: {error_message}")
        
        return {
            "type": "error",
            "error_type": error_type,
            "error_message": error_message,
            "user_message": user_message,
            "provider": self.name,
            "context": context
        }
    
    def create_event(self, event_type: str, **data) -> Dict[str, Any]:
        """
        Create a standardized event dictionary
        
        Args:
            event_type: Type of event (started, token, done, error)
            **data: Additional event data
            
        Returns:
            Formatted event dictionary
        """
        event = {
            "type": event_type,
            "provider": self.name,
            **data
        }
        
        return event
    
    def generate(
        self,
        messages: List[Dict[str, str]],
        model: str | None = None,
        params: Dict[str, Any] | None = None,
        stream: bool = True,
    ) -> Iterable[Dict[str, Any]]:
        """
        Generate response with dynamic parameter handling
        
        باید یک ژنراتور برگرداند که دیکشنری‌های رویداد را yield می‌کند:
        {"type":"started"} -> {"type":"token","delta":"..."}... -> {"type":"done"}
        
        Args:
            messages: List of conversation messages
            model: Model identifier
            params: Additional parameters
            stream: Whether to use streaming
            
        Yields:
            Event dictionaries with type, data, etc.
        """
        try:
            # Validate inputs
            if not messages:
                yield self.handle_api_error(ValueError("Messages are required"), "input_validation")
                return
            
            if not model:
                yield self.handle_api_error(ValueError("Model is required"), "input_validation")
                return
            
            # Validate model access
            is_valid, error_msg = self.validate_model_access(model)
            if not is_valid:
                yield self.handle_api_error(ValueError(error_msg), "model_validation")
                return
            
            # Prepare request data with dynamic parameter handling
            if params is None:
                params = {}
            
            # Add stream parameter
            params['stream'] = stream
            
            try:
                request_data = self.prepare_request_data(messages, model, params)
            except Exception as e:
                yield self.handle_api_error(e, "parameter_preparation")
                return
            
            # Emit started event
            yield self.create_event("started", model=model, provider=self.name)
            
            # This should be implemented by subclasses
            # For now, yield a placeholder
            yield self.create_event("token", delta="Base provider - implement in subclass")
            yield self.create_event("done", finish_reason="completed")
            
        except Exception as e:
            logger.error(f"Unexpected error in {self.name} generate: {e}")
            yield self.handle_api_error(e, "generate")
    
    def __str__(self) -> str:
        """String representation of the provider"""
        return f"{self.name.title()}Provider(region={self.region})"
    
    def __repr__(self) -> str:
        """Detailed string representation"""
        return f"{self.__class__.__name__}(name='{self.name}', region='{self.region}')"