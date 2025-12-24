"""
Anthropic Connector implementation.

Provides Anthropic Claude models integration for text generation and chat completion.
"""
from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from apps.core.guardrails.prompt_sanitizer import PromptSanitizer
import json
import os

logger = get_logger(__name__)


class AnthropicConnector(BaseConnector):
    """
    Anthropic Connector for text generation and chat completion.
    
    Supports Claude 3.5 Sonnet, Claude 3 Opus, and other Anthropic models.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Anthropic connector"""
        super().__init__(config)
        self.client = None
        self.sanitizer = PromptSanitizer()
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        manifest_path = os.path.join(
            os.path.dirname(__file__),
            'manifest.json'
        )
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Anthropic connector manifest: {str(e)}")
            raise
    
    def _initialize(self) -> None:
        """Initialize Anthropic client"""
        try:
            from anthropic import Anthropic
            
            api_key = self.config.get('api_key')
            if not api_key:
                raise ValueError("Anthropic API key is required")
            
            self.client = Anthropic(api_key=api_key)
            
            logger.info("Anthropic connector initialized successfully")
            
        except ImportError:
            raise ImportError(
                "anthropic package is required. Install with: pip install anthropic>=0.18.0"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {str(e)}")
            raise
    
    def _validate_inputs(self, action_id: str, inputs: Dict[str, Any]) -> None:
        """Validate inputs for safety and correctness"""
        if action_id == 'generate_text':
            prompt = inputs.get('prompt')
            if not prompt or len(prompt) == 0:
                raise ValueError("prompt is required and cannot be empty")
            
            if len(prompt) > 50000:
                raise ValueError("prompt cannot exceed 50000 characters")
            
            temperature = inputs.get('temperature', 1.0)
            if not 0.0 <= temperature <= 1.0:
                raise ValueError("temperature must be between 0.0 and 1.0")
            
            max_tokens = inputs.get('max_tokens', 1024)
            if not 1 <= max_tokens <= 4096:
                raise ValueError("max_tokens must be between 1 and 4096")
        
        elif action_id == 'chat':
            messages = inputs.get('messages')
            if not messages or not isinstance(messages, list):
                raise ValueError("messages is required and must be a list")
            
            if len(messages) == 0:
                raise ValueError("messages cannot be empty")
            
            for msg in messages:
                if not isinstance(msg, dict):
                    raise ValueError("Each message must be a dictionary")
                if 'role' not in msg or 'content' not in msg:
                    raise ValueError("Each message must have 'role' and 'content' fields")
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Anthropic action.
        
        Args:
            action_id: Action ID ('generate_text' or 'chat')
            inputs: Action inputs
            
        Returns:
            Dictionary with action outputs
        """
        if not self.client:
            raise RuntimeError("Anthropic client not initialized")
        
        # Sanitize inputs before validation and execution
        inputs = self.sanitizer.sanitize_data(inputs, apply_allowlist=True, apply_redaction=True)
        
        # Validate inputs
        self._validate_inputs(action_id, inputs)
        
        if action_id == 'generate_text':
            return self._execute_generate_text(inputs)
        elif action_id == 'chat':
            return self._execute_chat(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")
    
    def _execute_generate_text(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute generate_text action.
        
        Args:
            inputs: Action inputs (prompt, model, temperature, max_tokens, system_prompt)
            
        Returns:
            Dictionary with text, model_used, finish_reason, and usage
        """
        prompt = inputs.get('prompt')
        model = inputs.get('model', 'claude-3-5-sonnet-20241022')
        temperature = inputs.get('temperature', 1.0)
        max_tokens = inputs.get('max_tokens', 1024)
        system_prompt = inputs.get('system_prompt')
        
        # Log sanitized prompt (for audit trail)
        sanitized_prompt = self.sanitizer.sanitize_prompt(prompt)
        logger.info(
            f"Generating text with Anthropic model {model}",
            extra={
                'model': model,
                'prompt_length': len(prompt),
                'sanitized_prompt_preview': sanitized_prompt[:100] if sanitized_prompt else None
            }
        )
        
        try:
            kwargs = {
                'model': model,
                'max_tokens': max_tokens,
                'temperature': temperature,
                'messages': [{'role': 'user', 'content': prompt}]
            }
            
            if system_prompt:
                kwargs['system'] = system_prompt
            
            response = self.client.messages.create(**kwargs)
            
            # Extract response
            text = response.content[0].text
            
            # Extract usage information
            usage_data = {
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens
            }
            
            result = {
                'text': text,
                'model_used': model,
                'finish_reason': response.stop_reason,
                'usage': usage_data
            }
            
            logger.info(
                f"Anthropic text generation completed",
                extra={
                    'model': model,
                    'tokens_used': usage_data['input_tokens'] + usage_data['output_tokens'],
                    'finish_reason': response.stop_reason
                }
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to generate text with Anthropic: {str(e)}"
            logger.error(error_msg, extra={'model': model, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_chat(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute chat completion action.
        
        Args:
            inputs: Action inputs (messages, model, temperature, max_tokens, system_prompt)
            
        Returns:
            Dictionary with message, model_used, finish_reason, and usage
        """
        messages = inputs.get('messages')
        model = inputs.get('model', 'claude-3-5-sonnet-20241022')
        temperature = inputs.get('temperature', 1.0)
        max_tokens = inputs.get('max_tokens', 1024)
        system_prompt = inputs.get('system_prompt')
        
        # Log sanitized messages (for audit trail)
        sanitized_messages = self.sanitizer.sanitize_data(messages, apply_allowlist=True, apply_redaction=True)
        logger.info(
            f"Chat completion with Anthropic model {model}",
            extra={
                'model': model,
                'message_count': len(messages),
                'sanitized_messages': self.sanitizer.sanitize_for_logging(sanitized_messages)
            }
        )
        
        try:
            kwargs = {
                'model': model,
                'messages': messages,
                'max_tokens': max_tokens,
                'temperature': temperature
            }
            
            if system_prompt:
                kwargs['system'] = system_prompt
            
            response = self.client.messages.create(**kwargs)
            
            # Extract response
            message = {
                'role': 'assistant',
                'content': response.content[0].text
            }
            
            # Extract usage information
            usage_data = {
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens
            }
            
            result = {
                'message': message,
                'model_used': model,
                'finish_reason': response.stop_reason,
                'usage': usage_data
            }
            
            logger.info(
                f"Anthropic chat completion completed",
                extra={
                    'model': model,
                    'tokens_used': usage_data['input_tokens'] + usage_data['output_tokens'],
                    'finish_reason': response.stop_reason
                }
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to complete chat with Anthropic: {str(e)}"
            logger.error(error_msg, extra={'model': model, 'error': str(e)})
            raise Exception(error_msg)

