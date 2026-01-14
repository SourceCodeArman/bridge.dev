"""
HTTP Connector implementation.

Provides HTTP request capabilities with URL templating, response parsing, and error handling.
"""

import requests
import json
import xml.etree.ElementTree as ET
from typing import Dict, Any
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

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load HTTP connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                "id": "http",
                "name": "HTTP Request",
                "version": "1.0.0",
                "description": "Make HTTP requests to any endpoint",
                "author": "Bridge.dev",
                "connector_type": "action",
                "auth_config": {
                    "type": "custom",
                    "fields": [
                        {
                            "name": "headers",
                            "type": "object",
                            "required": False,
                            "description": "Custom headers to include in requests",
                        }
                    ],
                },
                "actions": [
                    {
                        "id": "request",
                        "name": "HTTP Request",
                        "description": "Make an HTTP request",
                        "input_schema": {
                            "type": "object",
                            "required": ["url", "method"],
                            "properties": {
                                "url": {
                                    "type": "string",
                                    "format": "uri",
                                    "description": "URL to request (supports templating)",
                                },
                                "method": {
                                    "type": "string",
                                    "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                                    "description": "HTTP method",
                                },
                                "headers": {
                                    "type": "object",
                                    "additionalProperties": {"type": "string"},
                                    "description": "HTTP headers",
                                },
                                "body": {
                                    "type": ["object", "string", "null"],
                                    "description": "Request body (for POST, PUT, PATCH)",
                                },
                                "params": {
                                    "type": "object",
                                    "additionalProperties": {"type": "string"},
                                    "description": "URL query parameters",
                                },
                                "timeout": {
                                    "type": "number",
                                    "description": "Request timeout in seconds (default: 30)",
                                },
                                "step_context": {
                                    "type": "object",
                                    "description": "Context from previous steps for templating",
                                },
                            },
                        },
                        "output_schema": {
                            "type": "object",
                            "properties": {
                                "status_code": {
                                    "type": "integer",
                                    "description": "HTTP status code",
                                },
                                "headers": {
                                    "type": "object",
                                    "additionalProperties": {"type": "string"},
                                    "description": "Response headers",
                                },
                                "body": {
                                    "type": ["object", "string", "null"],
                                    "description": "Response body (parsed if JSON/XML)",
                                },
                                "raw_body": {
                                    "type": "string",
                                    "description": "Raw response body as string",
                                },
                            },
                        },
                        "required_fields": ["url", "method"],
                    }
                ],
            }

    def _initialize(self) -> None:
        """Initialize HTTP connector (no special setup needed)"""
        # HTTP connector doesn't need special initialization

    def _parse_response_body(self, response: requests.Response) -> Dict[str, Any]:
        """
        Parse response body based on content type.

        Args:
            response: requests.Response object

        Returns:
            Dictionary with 'body' (parsed) and 'raw_body' (string)
        """
        content_type = response.headers.get("Content-Type", "").lower()
        raw_body = response.text

        parsed_body = None

        try:
            if "application/json" in content_type or content_type == "":
                # Try JSON parsing
                try:
                    parsed_body = response.json()
                except (ValueError, json.JSONDecodeError):
                    # Not JSON, use raw text
                    parsed_body = raw_body
            elif "application/xml" in content_type or "text/xml" in content_type:
                # Try XML parsing
                try:
                    root = ET.fromstring(raw_body)
                    # Convert XML to dict (simplified)
                    parsed_body = {"xml": raw_body, "root": root.tag}
                except ET.ParseError:
                    parsed_body = raw_body
            else:
                # Default to text
                parsed_body = raw_body
        except Exception as e:
            logger.warning(
                f"Failed to parse response body: {str(e)}",
                extra={"content_type": content_type, "error": str(e)},
            )
            parsed_body = raw_body

        return {"body": parsed_body, "raw_body": raw_body}

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HTTP request action.

        Args:
            action_id: Action ID (defaults to 'request' for backward compatibility)
            inputs: Action inputs (url, method, headers, body, etc.)

        Returns:
            Dictionary with status_code, headers, and body
        """
        # Map action_id to HTTP method
        valid_methods = {"get", "post", "put", "patch", "delete"}

        # Handle legacy 'request' action and normalize action_id
        if action_id in ("request", "action", ""):
            method = inputs.get("method", "GET").upper()
        elif action_id.lower() in valid_methods:
            method = action_id.upper()
        else:
            logger.warning(
                f"Unexpected action_id '{action_id}' for HTTP connector, defaulting to GET"
            )
            method = "GET"

        # Extract inputs
        url = inputs.get("url")
        if not url:
            raise ValueError("url is required")

        headers = inputs.get("headers", {})
        raw_body = inputs.get("body")
        params = inputs.get("params")
        timeout = inputs.get("timeout", 30)
        step_context = inputs.get("step_context", {})

        # Process body based on type (support new structured format from HttpBodyEditor)
        body = None
        body_content_type = None

        if isinstance(raw_body, dict) and "type" in raw_body:
            # New structured body format
            body_type = raw_body.get("type", "none")

            if body_type == "none":
                body = None
            elif body_type == "raw":
                body = raw_body.get("content", "")
                raw_type = raw_body.get("rawType", "json")
                if raw_type == "json":
                    body_content_type = "application/json"
                    # Try to parse as JSON
                    try:
                        body = json.loads(body) if body else None
                    except (ValueError, json.JSONDecodeError):
                        pass  # Keep as string
                elif raw_type == "xml":
                    body_content_type = "application/xml"
                elif raw_type == "html":
                    body_content_type = "text/html"
                elif raw_type == "javascript":
                    body_content_type = "application/javascript"
                else:
                    body_content_type = "text/plain"
            elif body_type == "form-data":
                # Process form-data pairs
                form_data = raw_body.get("formData", [])
                body = {
                    pair["key"]: pair["value"]
                    for pair in form_data
                    if pair.get("key") and pair.get("enabled", True)
                }
                body_content_type = "multipart/form-data"
            elif body_type == "x-www-form-urlencoded":
                # Process urlencoded pairs
                urlencoded = raw_body.get("urlencoded", [])
                body = {
                    pair["key"]: pair["value"]
                    for pair in urlencoded
                    if pair.get("key") and pair.get("enabled", True)
                }
                body_content_type = "application/x-www-form-urlencoded"
            elif body_type == "graphql":
                graphql = raw_body.get("graphql", {})
                query = graphql.get("query", "")
                variables = graphql.get("variables", "{}")
                try:
                    variables_parsed = json.loads(variables) if variables else {}
                except (ValueError, json.JSONDecodeError):
                    variables_parsed = {}
                body = {"query": query, "variables": variables_parsed}
                body_content_type = "application/json"
        elif raw_body:
            # Legacy string/dict body format
            body = raw_body

        # Render URL template if it contains template syntax
        if "{{" in url or "{%" in url:
            url = render_template(url, step_context)

        # Render params template if provided
        if params:
            rendered_params = {}
            for key, value in params.items():
                if isinstance(value, str) and ("{{" in value or "{%" in value):
                    rendered_params[key] = render_template(value, step_context)
                else:
                    rendered_params[key] = value
            params = rendered_params

        # Render headers template if provided
        if headers:
            rendered_headers = {}
            for key, value in headers.items():
                if isinstance(value, str) and ("{{" in value or "{%" in value):
                    rendered_headers[key] = render_template(value, step_context)
                else:
                    rendered_headers[key] = value
            headers = rendered_headers

        # Render body template if it's a string
        if isinstance(body, str) and ("{{" in body or "{%" in body):
            body = render_template(body, step_context)
            # Try to parse as JSON if it looks like JSON
            try:
                body = json.loads(body)
            except (ValueError, json.JSONDecodeError):
                pass  # Keep as string

        # Merge config headers with input headers
        config_headers = self.config.get("headers", {})
        merged_headers = {**config_headers, **headers}

        # Set content type if determined from body type
        if body_content_type and "Content-Type" not in merged_headers:
            merged_headers["Content-Type"] = body_content_type

        # Prepare request
        request_kwargs = {"headers": merged_headers, "timeout": timeout}

        if params:
            request_kwargs["params"] = params

        if body and method in ["POST", "PUT", "PATCH"]:
            # Determine content type
            content_type = merged_headers.get("Content-Type", "application/json")
            if "application/json" in content_type and isinstance(body, dict):
                request_kwargs["json"] = body
            elif "x-www-form-urlencoded" in content_type:
                request_kwargs["data"] = body
            else:
                request_kwargs["data"] = body

        # Make request
        try:
            logger.info(
                f"Making {method} request to {url}",
                extra={"url": url, "method": method},
            )

            response = requests.request(method, url, **request_kwargs)

            # Parse response body
            parsed_response = self._parse_response_body(response)

            # Convert headers to dict (Response.headers is a CaseInsensitiveDict)
            response_headers = dict(response.headers)

            result = {
                "status_code": response.status_code,
                "headers": response_headers,
                "body": parsed_response["body"],
                "raw_body": parsed_response["raw_body"],
            }

            logger.info(
                f"HTTP request completed with status {response.status_code}",
                extra={"url": url, "status_code": response.status_code},
            )

            return result

        except requests.exceptions.Timeout:
            error_msg = f"Request to {url} timed out after {timeout} seconds"
            logger.error(error_msg, extra={"url": url, "timeout": timeout})
            raise Exception(error_msg)
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error to {url}: {str(e)}"
            logger.error(error_msg, extra={"url": url, "error": str(e)})
            raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"HTTP request failed: {str(e)}"
            logger.error(error_msg, extra={"url": url, "error": str(e)})
            raise Exception(error_msg)
