"""
Gemini Connector implementation.

Provides Google Gemini models integration for text generation.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from apps.core.guardrails.prompt_sanitizer import PromptSanitizer
import json
import os

logger = get_logger(__name__)


class GeminiConnector(BaseConnector):
    """
    Gemini Connector for text generation.

    Supports Gemini Pro and other Google Gemini models.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Gemini connector"""
        super().__init__(config)
        self.client = None
        self.sanitizer = PromptSanitizer()

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Gemini connector manifest: {str(e)}")
            raise

    def _initialize(self) -> None:
        """Initialize Gemini client"""
        try:
            import google.generativeai as genai

            api_key = self.config.get("api_key")
            if not api_key:
                raise ValueError("Gemini API key is required")

            genai.configure(api_key=api_key)
            self.client = genai

            logger.info("Gemini connector initialized successfully")

        except ImportError:
            raise ImportError(
                "google-generativeai package is required. Install with: pip install google-generativeai>=0.3.0"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {str(e)}")
            raise

    def _validate_inputs(self, action_id: str, inputs: Dict[str, Any]) -> None:
        """Validate inputs for safety and correctness"""
        if action_id == "generate_text":
            prompt = inputs.get("prompt")
            if not prompt or len(prompt) == 0:
                raise ValueError("prompt is required and cannot be empty")

            if len(prompt) > 50000:
                raise ValueError("prompt cannot exceed 50000 characters")

            temperature = inputs.get("temperature", 1.0)
            if not 0.0 <= temperature <= 2.0:
                raise ValueError("temperature must be between 0.0 and 2.0")

            max_tokens = inputs.get("max_tokens", 2048)
            if not 1 <= max_tokens <= 8192:
                raise ValueError("max_tokens must be between 1 and 8192")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Gemini action.

        Args:
            action_id: Action ID ('generate_text')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if not self.client:
            raise RuntimeError("Gemini client not initialized")

        # Sanitize inputs before validation and execution
        inputs = self.sanitizer.sanitize_data(
            inputs, apply_allowlist=True, apply_redaction=True
        )

        # Validate inputs
        self._validate_inputs(action_id, inputs)

        if action_id == "generate_text":
            return self._execute_generate_text(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_generate_text(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute generate_text action.

        Args:
            inputs: Action inputs (prompt, model, temperature, max_tokens)

        Returns:
            Dictionary with text, model_used, finish_reason, and usage
        """
        prompt = inputs.get("prompt")
        model = inputs.get("model", "gemini-2.5-flash")  # Latest flash model
        temperature = inputs.get("temperature", 1.0)
        max_tokens = inputs.get("max_tokens", 2048)

        # Log sanitized prompt (for audit trail)
        sanitized_prompt = self.sanitizer.sanitize_prompt(prompt)
        logger.info(
            f"Generating text with Gemini model {model}",
            extra={
                "model": model,
                "prompt_length": len(prompt),
                "sanitized_prompt_preview": sanitized_prompt[:100]
                if sanitized_prompt
                else None,
            },
        )

        try:
            # Get the model
            gen_model = self.client.GenerativeModel(model)

            # Configure generation parameters
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }

            # Generate content
            response = gen_model.generate_content(
                prompt, generation_config=generation_config
            )

            # Check if response was blocked or empty
            if not response or not hasattr(response, "text"):
                # Check if response was blocked
                if hasattr(response, "prompt_feedback"):
                    block_reason = getattr(
                        response.prompt_feedback, "block_reason", None
                    )
                    if block_reason:
                        raise Exception(
                            f"Response was blocked by Gemini: {block_reason}"
                        )
                raise Exception("Gemini returned an empty or invalid response")

            # Extract response text
            try:
                text = response.text
            except ValueError as e:
                # This can happen if the response was blocked or has no text
                if hasattr(response, "candidates") and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, "finish_reason"):
                        finish_reason = (
                            candidate.finish_reason.name
                            if hasattr(candidate.finish_reason, "name")
                            else str(candidate.finish_reason)
                        )
                        raise Exception(
                            f"Gemini response has no text. Finish reason: {finish_reason}"
                        )
                raise Exception(
                    f"Failed to extract text from Gemini response: {str(e)}"
                )

            if not text:
                raise Exception("Gemini returned empty text")

            # Extract usage information (if available)
            usage_data = {
                "prompt_tokens": getattr(
                    response.usage_metadata, "prompt_token_count", 0
                )
                if hasattr(response, "usage_metadata")
                else 0,
                "completion_tokens": getattr(
                    response.usage_metadata, "candidates_token_count", 0
                )
                if hasattr(response, "usage_metadata")
                else 0,
                "total_tokens": getattr(response.usage_metadata, "total_token_count", 0)
                if hasattr(response, "usage_metadata")
                else 0,
            }

            # Determine finish reason
            finish_reason = "STOP"
            if hasattr(response, "candidates") and response.candidates:
                finish_reason = (
                    response.candidates[0].finish_reason.name
                    if hasattr(response.candidates[0], "finish_reason")
                    else "STOP"
                )

            result = {
                "text": text,
                "model_used": model,
                "finish_reason": finish_reason,
                "usage": usage_data,
            }

            logger.info(
                "Gemini text generation completed",
                extra={
                    "model": model,
                    "tokens_used": usage_data.get("total_tokens", 0),
                    "finish_reason": finish_reason,
                },
            )

            return result

        except Exception as e:
            error_msg = f"Failed to generate text with Gemini: {str(e)}"
            logger.error(error_msg, extra={"model": model, "error": str(e)})
            raise Exception(error_msg)
