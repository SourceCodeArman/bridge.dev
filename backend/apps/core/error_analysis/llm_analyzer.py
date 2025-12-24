"""
LLM-based error analyzer.

Uses LLM connectors to analyze workflow step failures and generate insights.
"""
from typing import Dict, Any, Optional
from apps.common.logging_utils import get_logger
from apps.core.connectors.base import ConnectorRegistry
from apps.core.models import Credential
from apps.core.encryption import get_encryption_service
from django.conf import settings

logger = get_logger(__name__)


class LLMErrorAnalyzer:
    """
    Analyzes errors using LLM connectors.
    """
    
    def __init__(self, llm_provider: str = 'openai', model: str = None):
        """
        Initialize analyzer with LLM provider.
        
        Args:
            llm_provider: LLM provider to use ('openai', 'anthropic', 'gemini', 'deepseek')
            model: Specific model to use (uses default if not specified)
        """
        self.llm_provider = llm_provider
        self.model = model
        self.registry = ConnectorRegistry()
    
    def _get_llm_connector(self, credential_id: Optional[str] = None):
        """
        Get LLM connector instance.
        
        Args:
            credential_id: Optional credential ID to use
            
        Returns:
            Connector instance
        """
        connector_class = self.registry.get(self.llm_provider)
        if not connector_class:
            raise ValueError(f"LLM connector {self.llm_provider} not found")
        
        # Get credential if provided
        config = {}
        if credential_id:
            try:
                credential = Credential.objects.get(id=credential_id)
                encryption_service = get_encryption_service()
                credential_data = encryption_service.decrypt_dict(credential.encrypted_data)
                config.update(credential_data)
            except Credential.DoesNotExist:
                logger.warning(f"Credential {credential_id} not found")
        
        # Use default credential from settings if available
        if not config:
            default_key = getattr(settings, f'{self.llm_provider.upper()}_API_KEY', None)
            if default_key:
                config['api_key'] = default_key
        
        if not config.get('api_key'):
            raise ValueError(f"API key not found for {self.llm_provider}")
        
        connector = connector_class(config)
        connector.initialize()
        
        return connector
    
    def analyze_error(self, context: Dict[str, Any], credential_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze error context using LLM.
        
        Args:
            context: Error context from LogIngestor
            credential_id: Optional credential ID for LLM API
            
        Returns:
            Dictionary with analysis results
        """
        try:
            connector = self._get_llm_connector(credential_id)
            
            # Build prompt for error analysis
            prompt = self._build_analysis_prompt(context)
            
            # Determine model to use
            model = self.model
            if not model:
                # Use default model based on provider
                defaults = {
                    'openai': 'gpt-3.5-turbo',
                    'anthropic': 'claude-3-5-sonnet-20241022',
                    'gemini': 'gemini-pro',
                    'deepseek': 'deepseek-chat'
                }
                model = defaults.get(self.llm_provider, 'gpt-3.5-turbo')
            
            # Call LLM
            if self.llm_provider in ['openai', 'deepseek']:
                # Use chat completion
                messages = [
                    {'role': 'system', 'content': 'You are an expert at analyzing workflow execution errors and providing actionable fix suggestions.'},
                    {'role': 'user', 'content': prompt}
                ]
                response = connector.execute('chat', {
                    'messages': messages,
                    'model': model,
                    'temperature': 0.3,
                    'max_tokens': 2000
                })
                analysis_text = response['message']['content']
            else:
                # Use text generation
                response = connector.execute('generate_text', {
                    'prompt': prompt,
                    'model': model,
                    'temperature': 0.3,
                    'max_tokens': 2000
                })
                analysis_text = response['text']
            
            # Parse response
            analysis = self._parse_analysis_response(analysis_text)
            
            logger.info(
                f"LLM analysis completed for step {context['step_id']}",
                extra={
                    'step_id': context['step_id'],
                    'error_type': analysis.get('error_type'),
                    'confidence': analysis.get('confidence')
                }
            )
            
            return analysis
            
        except Exception as e:
            logger.error(
                f"Failed to analyze error with LLM: {str(e)}",
                exc_info=e,
                extra={'step_id': context.get('step_id'), 'provider': self.llm_provider}
            )
            raise
    
    def _build_analysis_prompt(self, context: Dict[str, Any]) -> str:
        """Build prompt for LLM analysis"""
        prompt_parts = [
            "Analyze this workflow step failure and provide actionable suggestions:",
            "",
            f"Step Type: {context['step_type']}",
            f"Step ID: {context['step_id']}",
            f"Error: {context['error_message']}",
            "",
            "Inputs:",
            str(context['inputs']),
            "",
        ]
        
        if context.get('logs'):
            prompt_parts.extend([
                "Error Logs:",
                "\n".join([
                    f"[{log['level']}] {log['timestamp']}: {log['message']}"
                    for log in context['logs']
                ]),
                ""
            ])
        
        if context.get('other_failed_steps'):
            prompt_parts.extend([
                "Other Failed Steps in Run:",
                "\n".join([
                    f"- {step['step_id']} ({step['step_type']}): {step['error_message']}"
                    for step in context['other_failed_steps']
                ]),
                ""
            ])
        
        prompt_parts.extend([
            "Provide your analysis in the following JSON format:",
            "{",
            '  "error_type": "authentication_error|validation_error|network_error|configuration_error|other",',
            '  "root_cause": "Brief explanation of the root cause",',
            '  "suggestion": "Specific, actionable suggestion for fixing the error",',
            '  "confidence": 0.0-1.0,',
            '  "fix_data": { "corrected_field": "value" } // Optional: structured fix data if applicable',
            '  "actionable": true/false',
            "}"
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse LLM response into structured format"""
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                return {
                    'error_type': parsed.get('error_type', 'other'),
                    'root_cause': parsed.get('root_cause', ''),
                    'suggestion': parsed.get('suggestion', ''),
                    'confidence': float(parsed.get('confidence', 0.5)),
                    'fix_data': parsed.get('fix_data', {}),
                    'actionable': parsed.get('actionable', True)
                }
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse JSON from LLM response: {str(e)}")
        
        # Fallback: extract information from text
        return {
            'error_type': 'other',
            'root_cause': response_text[:200],
            'suggestion': response_text,
            'confidence': 0.5,
            'fix_data': {},
            'actionable': False
        }

