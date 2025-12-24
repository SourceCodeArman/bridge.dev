"""
HTTP Connector implementation.

Provides HTTP request capabilities with URL templating, response parsing, and error handling.
"""
import requests
import json
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from .templating import render_template

logger = get_logger(__name__)


class HTTPConnector(BaseConnector):
    """
    HTTP Connector for making HTTP requests.
    
    Supports GET, POST, PUT, DELETE, PATCH methods with configurable
    headers, body, URL templating, and response parsing.
    """
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os
        manifest_path = os.path.join(
            os.path.dirname(__file__),
            'manifest.json'
        )
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load HTTP connector manifest: {str(e)}")
            # Return minimal manifest
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
                                    'description': 'URL to request (supports templating)'
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
                                },
                                'step_context': {
                                    'type': 'object',
                                    'description': 'Context from previous steps for templating'
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
                                    'description': 'Response body (parsed if JSON/XML)'
                                },
                                'raw_body': {
                                    'type': 'string',
                                    'description': 'Raw response body as string'
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
    
    def _parse_response_body(self, response: requests.Response) -> Dict[str, Any]:
        """
        Parse response body based on content type.
        
        Args:
            response: requests.Response object
            
        Returns:
            Dictionary with 'body' (parsed) and 'raw_body' (string)
        """
        content_type = response.headers.get('Content-Type', '').lower()
        raw_body = response.text
        
        parsed_body = None
        
        try:
            if 'application/json' in content_type or content_type == '':
                # Try JSON parsing
                try:
                    parsed_body = response.json()
                except (ValueError, json.JSONDecodeError):
                    # Not JSON, use raw text
                    parsed_body = raw_body
            elif 'application/xml' in content_type or 'text/xml' in content_type:
                # Try XML parsing
                try:
                    root = ET.fromstring(raw_body)
                    # Convert XML to dict (simplified)
                    parsed_body = {'xml': raw_body, 'root': root.tag}
                except ET.ParseError:
                    parsed_body = raw_body
            else:
                # Default to text
                parsed_body = raw_body
        except Exception as e:
            logger.warning(
                f"Failed to parse response body: {str(e)}",
                extra={'content_type': content_type, 'error': str(e)}
            )
            parsed_body = raw_body
        
        return {
            'body': parsed_body,
            'raw_body': raw_body
        }
    
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
        if not url:
            raise ValueError("url is required")
        
        method = inputs.get('method', 'GET').upper()
        headers = inputs.get('headers', {})
        body = inputs.get('body')
        params = inputs.get('params')
        timeout = inputs.get('timeout', 30)
        step_context = inputs.get('step_context', {})
        
        # Render URL template if it contains template syntax
        if '{{' in url or '{%' in url:
            url = render_template(url, step_context)
        
        # Render params template if provided
        if params:
            rendered_params = {}
            for key, value in params.items():
                if isinstance(value, str) and ('{{' in value or '{%' in value):
                    rendered_params[key] = render_template(value, step_context)
                else:
                    rendered_params[key] = value
            params = rendered_params
        
        # Render headers template if provided
        if headers:
            rendered_headers = {}
            for key, value in headers.items():
                if isinstance(value, str) and ('{{' in value or '{%' in value):
                    rendered_headers[key] = render_template(value, step_context)
                else:
                    rendered_headers[key] = value
            headers = rendered_headers
        
        # Render body template if it's a string
        if isinstance(body, str) and ('{{' in body or '{%' in body):
            body = render_template(body, step_context)
            # Try to parse as JSON if it looks like JSON
            try:
                body = json.loads(body)
            except (ValueError, json.JSONDecodeError):
                pass  # Keep as string
        
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
            parsed_response = self._parse_response_body(response)
            
            # Convert headers to dict (Response.headers is a CaseInsensitiveDict)
            response_headers = dict(response.headers)
            
            result = {
                'status_code': response.status_code,
                'headers': response_headers,
                'body': parsed_response['body'],
                'raw_body': parsed_response['raw_body']
            }
            
            logger.info(
                f"HTTP request completed with status {response.status_code}",
                extra={'url': url, 'status_code': response.status_code}
            )
            
            return result
            
        except requests.exceptions.Timeout:
            error_msg = f"Request to {url} timed out after {timeout} seconds"
            logger.error(error_msg, extra={'url': url, 'timeout': timeout})
            raise Exception(error_msg)
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error to {url}: {str(e)}"
            logger.error(error_msg, extra={'url': url, 'error': str(e)})
            raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"HTTP request failed: {str(e)}"
            logger.error(error_msg, extra={'url': url, 'error': str(e)})
            raise Exception(error_msg)


