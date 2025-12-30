"""
HTTP Tool Connector implementation.

Provides HTTP request capabilities for agent tools.
"""

from typing import Dict, Any
import requests
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class HTTPToolConnector(BaseConnector):
    """
    HTTP Tool Connector for agent tools.

    Makes HTTP requests to any endpoint.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize HTTP Tool connector"""
        super().__init__(config)
        self.default_headers = {}
        self.default_timeout = 30

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize HTTP client configuration"""
        self.default_headers = self.config.get("default_headers", {})
        self.default_timeout = self.config.get("timeout", 30)

        logger.info("HTTP Tool connector initialized successfully")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HTTP Tool action.

        Args:
            action_id: Action ID ('request')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "request":
            return self._execute_request(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_request(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HTTP request.

        Args:
            inputs: Request parameters (url, method, headers, params, body, timeout)

        Returns:
            Dictionary with response data
        """
        url = inputs.get("url")
        method = inputs.get("method", "GET").upper()
        headers = {**self.default_headers, **inputs.get("headers", {})}
        params = inputs.get("params", {})
        body = inputs.get("body")
        timeout = inputs.get("timeout", self.default_timeout)

        if not url:
            raise ValueError("url is required")
        if method not in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
            raise ValueError(f"Invalid method: {method}")

        logger.info(f"Making {method} request to {url}")

        try:
            # Prepare request kwargs
            request_kwargs = {"headers": headers, "params": params, "timeout": timeout}

            # Add body for methods that support it
            if method in ["POST", "PUT", "PATCH"] and body is not None:
                if isinstance(body, dict):
                    request_kwargs["json"] = body
                else:
                    request_kwargs["data"] = body

            # Make the request
            response = requests.request(method, url, **request_kwargs)

            # Parse response body
            raw_body = response.text
            try:
                parsed_body = response.json()
            except:
                parsed_body = raw_body

            result = {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": parsed_body,
                "raw_body": raw_body,
            }

            logger.info(f"HTTP request completed with status {response.status_code}")

            return result

        except requests.exceptions.Timeout:
            error_msg = f"HTTP request timed out after {timeout}s"
            logger.error(error_msg)
            raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"HTTP request failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error during HTTP request: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
