"""
Webhook Connector implementation.

Provides outbound webhook capabilities with signature support and retry logic.
"""

import requests
import json
import hmac
import hashlib
import time
from typing import Dict, Any, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from .templating import render_template

logger = get_logger(__name__)


class WebhookConnector(BaseConnector):
    """
    Webhook Connector for sending outbound webhooks.

    Supports signature generation (HMAC), retry logic with exponential backoff,
    and configurable timeout and retry attempts.
    """

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "webhook_manifest.json")
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load webhook connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                "id": "outbound_webhook",
                "name": "Webhook",
                "version": "1.0.0",
                "description": "Send outbound webhooks with signature support",
                "author": "Bridge.dev",
                "connector_type": "action",
                "auth_config": {
                    "type": "custom",
                    "fields": [
                        {
                            "name": "secret",
                            "type": "password",
                            "required": False,
                            "description": "Secret key for HMAC signature generation",
                        }
                    ],
                },
                "actions": [
                    {
                        "id": "send_webhook",
                        "name": "Send Webhook",
                        "description": "Send webhook payload to URL with optional signature",
                        "input_schema": {
                            "type": "object",
                            "required": ["url", "payload"],
                            "properties": {
                                "url": {
                                    "type": "string",
                                    "format": "uri",
                                    "description": "Webhook URL",
                                },
                                "payload": {
                                    "type": ["object", "string"],
                                    "description": "Webhook payload data",
                                },
                                "method": {
                                    "type": "string",
                                    "enum": ["POST", "PUT"],
                                    "default": "POST",
                                    "description": "HTTP method",
                                },
                                "headers": {
                                    "type": "object",
                                    "additionalProperties": {"type": "string"},
                                    "description": "Additional HTTP headers",
                                },
                                "signature_method": {
                                    "type": "string",
                                    "enum": ["hmac_sha256", "hmac_sha1", "none"],
                                    "default": "none",
                                    "description": "Signature method",
                                },
                                "signature_header": {
                                    "type": "string",
                                    "default": "X-Webhook-Signature",
                                    "description": "Header name for signature",
                                },
                                "timeout": {
                                    "type": "number",
                                    "default": 30,
                                    "description": "Request timeout in seconds",
                                },
                                "max_retries": {
                                    "type": "integer",
                                    "default": 3,
                                    "minimum": 0,
                                    "maximum": 10,
                                    "description": "Maximum number of retry attempts",
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
                                "success": {
                                    "type": "boolean",
                                    "description": "Whether webhook was sent successfully",
                                },
                                "response_body": {
                                    "type": ["object", "string", "null"],
                                    "description": "Response body from webhook endpoint",
                                },
                                "retry_count": {
                                    "type": "integer",
                                    "description": "Number of retries attempted",
                                },
                            },
                        },
                        "required_fields": ["url", "payload"],
                    }
                ],
            }

    def _initialize(self) -> None:
        """Initialize webhook connector (no special setup needed)"""

    def _generate_hmac_signature(
        self, payload: str, secret: str, algorithm: str = "sha256"
    ) -> str:
        """
        Generate HMAC signature for webhook payload.

        Args:
            payload: Payload string to sign
            secret: Secret key for HMAC
            algorithm: Hash algorithm ('sha256' or 'sha1')

        Returns:
            Hexadecimal signature string
        """
        if algorithm == "sha256":
            hash_func = hashlib.sha256
        elif algorithm == "sha1":
            hash_func = hashlib.sha1
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")

        signature = hmac.new(
            secret.encode("utf-8"), payload.encode("utf-8"), hash_func
        ).hexdigest()

        return signature

    def _prepare_payload(
        self, payload: Any, step_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Prepare payload for webhook (convert to JSON string).

        Args:
            payload: Payload data (dict or string)
            step_context: Step context for templating

        Returns:
            JSON string representation of payload
        """
        if isinstance(payload, str):
            # If string, try to render template first
            if step_context and ("{{" in payload or "{%" in payload):
                payload = render_template(payload, step_context)
                # Try to parse as JSON
                try:
                    payload = json.loads(payload)
                except (ValueError, json.JSONDecodeError):
                    # Keep as string
                    return payload
            else:
                return payload
        elif isinstance(payload, dict):
            # Convert dict to JSON string
            return json.dumps(payload)
        else:
            # Convert to JSON
            return json.dumps(payload)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(
            (requests.exceptions.ConnectionError, requests.exceptions.Timeout)
        ),
    )
    def _send_webhook_request(
        self, url: str, method: str, headers: Dict[str, str], payload: str, timeout: int
    ) -> requests.Response:
        """
        Send webhook request with retry logic.

        Args:
            url: Webhook URL
            method: HTTP method (POST or PUT)
            headers: HTTP headers
            payload: Payload string
            timeout: Request timeout

        Returns:
            requests.Response object

        Raises:
            requests.exceptions.RequestException: If request fails after retries
        """
        response = requests.request(
            method=method, url=url, headers=headers, data=payload, timeout=timeout
        )

        # Raise exception for 4xx/5xx status codes (will trigger retry for connection errors)
        if response.status_code >= 500:
            # Retry on server errors
            response.raise_for_status()
        elif response.status_code >= 400:
            # Don't retry on client errors (4xx)
            logger.warning(
                f"Webhook returned client error {response.status_code}",
                extra={"url": url, "status_code": response.status_code},
            )

        return response

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute webhook send action.

        Args:
            action_id: Action ID (should be 'send_webhook')
            inputs: Action inputs (url, payload, etc.)

        Returns:
            Dictionary with status_code, success, and response_body
        """
        if action_id != "send_webhook":
            raise ValueError(f"Unknown action: {action_id}")

        # Extract inputs
        url = inputs.get("url")
        if not url:
            raise ValueError("url is required")

        payload = inputs.get("payload")
        if payload is None:
            raise ValueError("payload is required")

        method = inputs.get("method", "POST").upper()
        if method not in ["POST", "PUT"]:
            raise ValueError(f"Method must be POST or PUT, got {method}")

        headers = inputs.get("headers", {})
        signature_method = inputs.get("signature_method", "none")
        signature_header = inputs.get("signature_header", "X-Webhook-Signature")
        timeout = inputs.get("timeout", 30)
        max_retries = inputs.get("max_retries", 3)
        step_context = inputs.get("step_context", {})

        # Render URL template if needed
        if "{{" in url or "{%" in url:
            url = render_template(url, step_context)

        # Prepare payload
        payload_str = self._prepare_payload(payload, step_context)

        # Prepare headers
        merged_headers = {"Content-Type": "application/json", **headers}

        # Generate signature if requested
        if signature_method != "none":
            secret = self.config.get("secret")
            if not secret:
                raise ValueError(
                    f"secret is required for signature method {signature_method}"
                )

            algorithm = "sha256" if signature_method == "hmac_sha256" else "sha1"
            signature = self._generate_hmac_signature(payload_str, secret, algorithm)
            merged_headers[signature_header] = signature

            logger.debug(
                f"Generated {signature_method} signature for webhook",
                extra={"url": url, "signature_method": signature_method},
            )

        # Send webhook with retry logic
        retry_count = 0
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                logger.info(
                    f"Sending webhook to {url} (attempt {attempt + 1}/{max_retries + 1})",
                    extra={"url": url, "method": method, "attempt": attempt + 1},
                )

                response = self._send_webhook_request(
                    url=url,
                    method=method,
                    headers=merged_headers,
                    payload=payload_str,
                    timeout=timeout,
                )

                # Parse response body
                try:
                    response_body = response.json()
                except (ValueError, json.JSONDecodeError):
                    response_body = response.text

                result = {
                    "status_code": response.status_code,
                    "success": 200 <= response.status_code < 300,
                    "response_body": response_body,
                    "retry_count": retry_count,
                }

                logger.info(
                    f"Webhook sent successfully with status {response.status_code}",
                    extra={
                        "url": url,
                        "status_code": response.status_code,
                        "retries": retry_count,
                    },
                )

                return result

            except (
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
            ) as e:
                retry_count = attempt + 1
                last_exception = e

                if attempt < max_retries:
                    wait_time = min(2**attempt, 10)  # Exponential backoff, max 10s
                    logger.warning(
                        f"Webhook request failed, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries + 1})",
                        extra={"url": url, "error": str(e), "attempt": attempt + 1},
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"Webhook request failed after {max_retries + 1} attempts",
                        extra={"url": url, "error": str(e), "retries": max_retries + 1},
                    )
                    raise Exception(
                        f"Webhook request failed after {max_retries + 1} attempts: {str(e)}"
                    )

            except requests.exceptions.RequestException as e:
                # Don't retry on other request exceptions (4xx errors, etc.)
                error_msg = f"Webhook request failed: {str(e)}"
                logger.error(
                    error_msg,
                    extra={
                        "url": url,
                        "error": str(e),
                        "status_code": getattr(e.response, "status_code", None),
                    },
                )
                raise Exception(error_msg)

        # Should not reach here, but handle just in case
        if last_exception:
            raise Exception(f"Webhook request failed: {str(last_exception)}")
        else:
            raise Exception("Webhook request failed for unknown reason")
