"""
Webhook Connector implementation.

Provides webhook trigger capabilities for workflows.
"""

from typing import Dict, Any
import hashlib
import hmac
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class WebhookConnector(BaseConnector):
    """
    Webhook Connector for workflow triggers.

    Receives and processes incoming webhook requests.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Webhook connector"""
        super().__init__(config)
        self.secret = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize Webhook connector"""
        self.secret = self.config.get("secret")
        logger.info("Webhook connector initialized successfully")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Webhook action.

        Args:
            action_id: Action ID ('receive')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "receive":
            return self._execute_receive(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _verify_signature(self, payload: str, signature: str) -> bool:
        """
        Verify webhook signature.

        Args:
            payload: Raw payload string
            signature: Signature from request headers

        Returns:
            True if signature is valid
        """
        if not self.secret:
            return True  # No verification if no secret is set

        try:
            expected_signature = hmac.new(
                self.secret.encode(), payload.encode(), hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(signature, expected_signature)
        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            return False

    def _execute_receive(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receive and parse webhook request.

        Args:
            inputs: Webhook request data (method, headers, body, query_params)

        Returns:
            Dictionary with parsed webhook data
        """
        method = inputs.get("method", "POST")
        headers = inputs.get("headers", {})
        body = inputs.get("body")
        query_params = inputs.get("query_params", {})

        logger.info(f"Receiving webhook: {method}")

        try:
            # Verify signature if secret is configured
            verified = True
            if self.secret:
                signature = headers.get("X-Webhook-Signature", "")
                if signature:
                    import json

                    payload_str = (
                        json.dumps(body) if isinstance(body, dict) else str(body)
                    )
                    verified = self._verify_signature(payload_str, signature)
                else:
                    verified = False
                    logger.warning("Webhook signature missing but secret is configured")

            # Parse body if it's a string
            parsed_body = body
            if isinstance(body, str):
                try:
                    import json

                    parsed_body = json.loads(body)
                except Exception:
                    # Keep as string if not valid JSON
                    pass

            result = {
                "method": method,
                "headers": headers,
                "body": parsed_body,
                "query_params": query_params,
                "verified": verified,
            }

            logger.info(f"Webhook received and parsed (verified: {verified})")

            return result

        except Exception as e:
            error_msg = f"Webhook processing failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
