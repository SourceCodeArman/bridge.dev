"""
Prompt sanitizer service for LLM guardrails.

Implements field allowlisting and integrates with secret redaction
to ensure only safe data is sent to LLM APIs.
"""
from typing import Any, Dict, List, Optional, Tuple
from django.conf import settings
from apps.common.logging_utils import get_logger
from .secret_redactor import SecretRedactor

logger = get_logger(__name__)


class PromptSanitizer:
    """
    Service for sanitizing prompts before sending to LLMs.
    
    Implements:
    - Field allowlisting (only specified fields allowed)
    - Secret redaction
    - Prompt validation
    """
    
    def __init__(self):
        """Initialize prompt sanitizer with settings."""
        self.redactor = SecretRedactor()
        
        # Get settings with defaults
        self.secret_redaction_enabled = getattr(
            settings,
            'LLM_SECRET_REDACTION_ENABLED',
            True
        )
        self.field_allowlist_enabled = getattr(
            settings,
            'LLM_FIELD_ALLOWLIST_ENABLED',
            True
        )
        self.allowed_fields = set(getattr(
            settings,
            'LLM_ALLOWED_FIELDS',
            [
                'id', 'name', 'title', 'description', 'type',
                'action_id', 'connector_id', 'prompt', 'messages',
                'model', 'temperature', 'max_tokens', 'system_prompt',
                'content', 'role', 'text', 'status', 'created_at',
                'updated_at', 'version_number', 'workflow_id',
                'node_id', 'edge_id', 'position', 'data',
            ]
        ))
    
    def sanitize_prompt(self, prompt: str) -> str:
        """
        Sanitize a prompt string by redacting secrets.
        
        Args:
            prompt: Prompt string to sanitize
            
        Returns:
            Sanitized prompt with secrets redacted
        """
        if not self.secret_redaction_enabled:
            return prompt
        
        sanitized = self.redactor.redact_string(prompt)
        
        if sanitized != prompt:
            logger.debug(
                "Sanitized prompt: secrets redacted",
                extra={'original_length': len(prompt), 'sanitized_length': len(sanitized)}
            )
        
        return sanitized
    
    def sanitize_data(
        self,
        data: Dict[str, Any],
        apply_allowlist: bool = True,
        apply_redaction: bool = True
    ) -> Dict[str, Any]:
        """
        Sanitize a data dictionary by applying allowlist and redaction.
        
        Args:
            data: Data dictionary to sanitize
            apply_allowlist: If True, apply field allowlist
            apply_redaction: If True, apply secret redaction
            
        Returns:
            Sanitized data dictionary
        """
        if not isinstance(data, dict):
            return data
        
        # First apply allowlist if enabled
        if apply_allowlist and self.field_allowlist_enabled:
            data = self._apply_allowlist(data)
        
        # Then apply redaction if enabled
        if apply_redaction and self.secret_redaction_enabled:
            data = self.redactor.redact_dict(data, redact_field_names=True)
        
        return data
    
    def _apply_allowlist(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply field allowlist to data dictionary.
        
        Only fields in the allowlist are kept. Nested structures
        are recursively processed.
        
        Args:
            data: Data dictionary to filter
            
        Returns:
            Filtered data dictionary with only allowed fields
        """
        if not isinstance(data, dict):
            return data
        
        filtered = {}
        for key, value in data.items():
            # Check if key is in allowlist
            if key in self.allowed_fields:
                # Recursively process nested structures
                if isinstance(value, dict):
                    filtered[key] = self._apply_allowlist(value)
                elif isinstance(value, list):
                    filtered[key] = [
                        self._apply_allowlist(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    filtered[key] = value
            else:
                # Field not in allowlist - log and skip
                logger.debug(
                    f"Field '{key}' filtered out by allowlist",
                    extra={'field_name': key, 'allowed_fields': list(self.allowed_fields)}
                )
        
        return filtered
    
    def sanitize_connector_info(self, connector_info: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sanitize connector information before sending to LLM.
        
        Removes credential references and applies allowlist.
        
        Args:
            connector_info: List of connector information dictionaries
            
        Returns:
            Sanitized connector information
        """
        sanitized = []
        for connector in connector_info:
            # Create sanitized copy
            sanitized_connector = {
                'id': connector.get('id'),
                'name': connector.get('name'),
                'description': connector.get('description'),
                'actions': []
            }
            
            # Sanitize actions
            for action in connector.get('actions', []):
                sanitized_action = {
                    'id': action.get('id'),
                    'name': action.get('name'),
                    'description': action.get('description'),
                }
                # Only include required_fields if they're in allowlist
                if 'required_fields' in action:
                    sanitized_action['required_fields'] = [
                        field for field in action.get('required_fields', [])
                        if field in self.allowed_fields
                    ]
                sanitized_connector['actions'].append(sanitized_action)
            
            sanitized.append(sanitized_connector)
        
        return sanitized
    
    def sanitize_workflow_definition(self, definition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize workflow definition before sending to LLM.
        
        Applies allowlist and redaction to workflow graph data.
        
        Args:
            definition: Workflow definition dictionary
            
        Returns:
            Sanitized workflow definition
        """
        # Create a copy to avoid modifying original
        sanitized = definition.copy()
        
        # Sanitize nodes
        if 'nodes' in sanitized:
            sanitized['nodes'] = [
                self.sanitize_data(node, apply_allowlist=True, apply_redaction=True)
                for node in sanitized['nodes']
            ]
        
        # Sanitize edges (usually safe, but apply redaction just in case)
        if 'edges' in sanitized:
            sanitized['edges'] = [
                self.sanitize_data(edge, apply_allowlist=False, apply_redaction=True)
                for edge in sanitized['edges']
            ]
        
        return sanitized
    
    def validate_prompt(self, prompt: str) -> Tuple[bool, Optional[str]]:
        """
        Validate a prompt before sending to LLM.
        
        Args:
            prompt: Prompt string to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not prompt or len(prompt.strip()) == 0:
            return False, "Prompt cannot be empty"
        
        if len(prompt) > 100000:  # Reasonable limit
            return False, "Prompt exceeds maximum length (100,000 characters)"
        
        # Check for obvious secret patterns that weren't redacted
        if self.secret_redaction_enabled:
            # Check for long alphanumeric strings that might be secrets
            import re
            long_strings = re.findall(r'\b[a-zA-Z0-9_\-]{40,}\b', prompt)
            if long_strings:
                logger.warning(
                    "Prompt contains potential secrets that should be redacted",
                    extra={'long_strings_count': len(long_strings)}
                )
        
        return True, None
    
    def sanitize_for_logging(self, data: Any) -> Any:
        """
        Sanitize data specifically for logging purposes.
        
        More aggressive redaction for logs.
        
        Args:
            data: Data to sanitize
            
        Returns:
            Sanitized data safe for logging
        """
        if isinstance(data, dict):
            return self.redactor.redact_dict(data, redact_field_names=True)
        elif isinstance(data, list):
            return [
                self.sanitize_for_logging(item)
                for item in data
            ]
        elif isinstance(data, str):
            return self.redactor.redact_string(data)
        else:
            return data

