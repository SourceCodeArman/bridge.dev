"""
Secret redaction service for LLM guardrails.

Recursively scans data structures to identify and redact secrets before
sending to LLM APIs or logging.
"""
import re
from typing import Any, Dict, List, Union, Optional
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class SecretRedactor:
    """
    Service for redacting secrets from data structures.
    
    Recursively scans dictionaries, lists, and strings to identify
    and redact sensitive information using pattern matching.
    """
    
    # Secret patterns based on SecretMaskingFilter from logging_utils
    SECRET_PATTERNS = [
        # API keys (e.g., sk_live_..., api_key_..., etc.)
        (r'(?i)(api[_-]?key|apikey)\s*[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', r'\1: ***REDACTED***'),
        # Bearer tokens
        (r'(?i)(bearer|token|authorization)\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.]{20,})["\']?', r'\1: ***REDACTED***'),
        # OAuth tokens
        (r'(?i)(oauth[_-]?token|access[_-]?token)\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.]{20,})["\']?', r'\1: ***REDACTED***'),
        # Passwords
        (r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', r'\1: ***REDACTED***'),
        # Secret keys
        (r'(?i)(secret[_-]?key|secret)\s*[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', r'\1: ***REDACTED***'),
        # Private keys (PEM format)
        (r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----', '***REDACTED PRIVATE KEY***'),
        # OpenAI API keys (sk-...)
        (r'sk-[a-zA-Z0-9]{32,}', 'sk-***REDACTED***'),
        # Anthropic API keys (sk-ant-...)
        (r'sk-ant-[a-zA-Z0-9\-]{32,}', 'sk-ant-***REDACTED***'),
        # Note: Generic long strings pattern handled separately in _looks_like_secret
    ]
    
    # Field names that commonly contain secrets
    SECRET_FIELD_NAMES = [
        'api_key', 'apikey', 'api-key',
        'token', 'access_token', 'oauth_token',
        'password', 'passwd', 'pwd',
        'secret', 'secret_key', 'secret-key',
        'private_key', 'private-key',
        'credential', 'credentials',
        'auth', 'authorization',
    ]
    
    def __init__(self, redaction_marker: str = '***REDACTED***'):
        """
        Initialize secret redactor.
        
        Args:
            redaction_marker: String to use for redaction (default: ***REDACTED***)
        """
        self.redaction_marker = redaction_marker
        # Compile patterns for better performance
        self.compiled_patterns = [
            (re.compile(pattern), replacement)
            for pattern, replacement in self.SECRET_PATTERNS
        ]
    
    def _looks_like_secret(self, value: str) -> bool:
        """
        Check if a string value looks like a secret.
        
        Args:
            value: String to check
            
        Returns:
            True if value looks like a secret
        """
        # Check if it's a very long alphanumeric string
        if len(value) < 20:
            return False
        
        # Check if it matches common secret patterns
        for pattern, _ in self.SECRET_PATTERNS:
            if isinstance(pattern, str) and re.search(pattern, value):
                return True
        
        return False
    
    def redact_string(self, text: str) -> str:
        """
        Redact secrets from a string.
        
        Args:
            text: String to redact
            
        Returns:
            String with secrets redacted
        """
        if not isinstance(text, str):
            return text
        
        result = text
        for pattern, replacement in self.compiled_patterns:
            if callable(replacement):
                # Replacement is a lambda/function
                result = pattern.sub(lambda m: replacement(m) if callable(replacement) else self.redaction_marker, result)
            else:
                result = pattern.sub(replacement, result)
        
        return result
    
    def redact_dict(self, data: Dict[str, Any], redact_field_names: bool = True) -> Dict[str, Any]:
        """
        Recursively redact secrets from a dictionary.
        
        Args:
            data: Dictionary to redact
            redact_field_names: If True, redact values for fields with secret-like names
            
        Returns:
            Dictionary with secrets redacted
        """
        if not isinstance(data, dict):
            return data
        
        redacted = {}
        for key, value in data.items():
            # Check if field name suggests it contains a secret
            if redact_field_names and any(
                secret_name in key.lower() 
                for secret_name in self.SECRET_FIELD_NAMES
            ):
                redacted[key] = self.redaction_marker
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value, redact_field_names)
            elif isinstance(value, list):
                redacted[key] = self.redact_list(value, redact_field_names)
            elif isinstance(value, str):
                # Redact secrets in string values
                redacted[key] = self.redact_string(value)
            else:
                redacted[key] = value
        
        return redacted
    
    def redact_list(self, data: List[Any], redact_field_names: bool = True) -> List[Any]:
        """
        Recursively redact secrets from a list.
        
        Args:
            data: List to redact
            redact_field_names: If True, redact values for fields with secret-like names
            
        Returns:
            List with secrets redacted
        """
        if not isinstance(data, list):
            return data
        
        return [
            self.redact(value, redact_field_names)
            for value in data
        ]
    
    def redact(self, data: Any, redact_field_names: bool = True) -> Any:
        """
        Recursively redact secrets from any data structure.
        
        Args:
            data: Data to redact (dict, list, str, or other)
            redact_field_names: If True, redact values for fields with secret-like names
            
        Returns:
            Data with secrets redacted
        """
        if isinstance(data, dict):
            return self.redact_dict(data, redact_field_names)
        elif isinstance(data, list):
            return self.redact_list(data, redact_field_names)
        elif isinstance(data, str):
            return self.redact_string(data)
        else:
            return data
    
    def redact_credentials(self, data: Dict[str, Any], credential_fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Redact credential data from a dictionary.
        
        This is specifically for credential vault data that may contain
        encrypted or decrypted credential information.
        
        Args:
            data: Dictionary containing credential data
            credential_fields: Optional list of field names to always redact
            
        Returns:
            Dictionary with credential data redacted
        """
        if credential_fields is None:
            credential_fields = ['api_key', 'token', 'password', 'secret', 'private_key']
        
        redacted = data.copy()
        for field in credential_fields:
            if field in redacted:
                redacted[field] = self.redaction_marker
        
        # Also apply general redaction
        return self.redact_dict(redacted, redact_field_names=True)

