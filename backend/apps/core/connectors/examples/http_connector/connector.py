"""
HTTP Connector implementation.

Provides HTTP request capabilities (GET, POST, PUT, DELETE, PATCH).
"""
import requests
from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class HTTPConnector(BaseConnector):
    """
    HTTP Connector for making HTTP requests.
    
    Supports GET, POST, PUT, DELETE, PATCH methods with configurable
    headers, body, and URL templating.
    """
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        return {
            'id': 'http',
            'name': 'HTTP Request',
            'version': '1.0.0',
            'description': 'Make HTTP requests to any endpoint',
            'author': 'Bridge.dev',
            'connector_type': 'action',
            'auth_config': {
                'type': 'custom',
                'fields': [
                    {
                        'name': 'headers',
                        'type': 'object',
                        'required': False,
                        'description': 'Custom headers to include in requests'
                    }
                ]
            },
            'actions': [
                {
                    'id': 'request',
                    'name': 'HTTP Request',
                    'description': 'Make an HTTP request',
                    'input_schema': {
                        'type': 'object',
                        'required': ['url', 'method'],
                        'properties': {
                            'url': {
                                'type': 'string',
                                'format': 'uri',
                                'description': 'URL to request'
                            },
                            'method': {
                                'type': 'string',
                                'enum': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                                'description': 'HTTP method'
                            },
                            'headers': {
                                'type': 'object',
                                'additionalProperties': {'type': 'string'},
                                'description': 'HTTP headers'
                            },
                            'body': {
                                'type': ['object', 'string', 'null'],
                                'description': 'Request body (for POST, PUT, PATCH)'
                            },
                            'params': {
                                'type': 'object',
                                'additionalProperties': {'type': 'string'},
                                'description': 'URL query parameters'
                            },
                            'timeout': {
                                'type': 'number',
                                'description': 'Request timeout in seconds (default: 30)'
                            }
                        }
                    },
                    'output_schema': {
                        'type': 'object',
                        'properties': {
                            'status_code': {
                                'type': 'integer',
                                'description': 'HTTP status code'
                            },
                            'headers': {
                                'type': 'object',
                                'additionalProperties': {'type': 'string'},
                                'description': 'Response headers'
                            },
                            'body': {
                                'type': ['object', 'string', 'null'],
                                'description': 'Response body'
                            }
                        }
                    },
                    'required_fields': ['url', 'method']
                }
            ]
        }
    
    def _initialize(self) -> None:
        """Initialize HTTP connector (no special setup needed)"""
        # HTTP connector doesn't need special initialization
        pass
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HTTP request action.
        
        Args:
            action_id: Action ID (should be 'request')
            inputs: Action inputs (url, method, headers, body, etc.)
            
        Returns:
            Dictionary with status_code, headers, and body
        """
        if action_id != 'request':
            raise ValueError(f"Unknown action: {action_id}")
        
        # Extract inputs
        url = inputs.get('url')
        method = inputs.get('method', 'GET').upper()
        headers = inputs.get('headers', {})
        body = inputs.get('body')
        params = inputs.get('params')
        timeout = inputs.get('timeout', 30)
        
        # Merge config headers with input headers
        config_headers = self.config.get('headers', {})
        merged_headers = {**config_headers, **headers}
        
        # Prepare request
        request_kwargs = {
            'headers': merged_headers,
            'timeout': timeout
        }
        
        if params:
            request_kwargs['params'] = params
        
        if body and method in ['POST', 'PUT', 'PATCH']:
            # Determine content type
            content_type = merged_headers.get('Content-Type', 'application/json')
            if content_type == 'application/json' and isinstance(body, dict):
                request_kwargs['json'] = body
            else:
                request_kwargs['data'] = body
        
        # Make request
        try:
            logger.info(
                f"Making {method} request to {url}",
                extra={'url': url, 'method': method}
            )
            
            response = requests.request(method, url, **request_kwargs)
            
            # Parse response body
            try:
                response_body = response.json()
            except ValueError:
                response_body = response.text
            
            # Convert headers to dict (Response.headers is a CaseInsensitiveDict)
            response_headers = dict(response.headers)
            
            result = {
                'status_code': response.status_code,
                'headers': response_headers,
                'body': response_body
            }
            
            logger.info(
                f"HTTP request completed with status {response.status_code}",
                extra={'url': url, 'status_code': response.status_code}
            )
            
            return result
            
        except requests.exceptions.Timeout:
            raise Exception(f"Request to {url} timed out after {timeout} seconds")
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Connection error to {url}: {str(e)}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"HTTP request failed: {str(e)}")

