"""
OpenAI Model Connector implementation.

Provides OpenAI LLM integration for agent models.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class OpenAIModelConnector(BaseConnector):
    """
    OpenAI Model Connector for agent models.

    Provides LLM capabilities using OpenAI API.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize OpenAI Model connector"""
        super().__init__(config)
        self.client = None
        self.model_config = {
            "model": "gpt-3.5-turbo",
            "temperature": 1.0,
            "max_tokens": 1000,
        }

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize OpenAI client"""
        try:
            from openai import OpenAI

            api_key = self.config.get("api_key")

            if not api_key:
                raise ValueError("api_key is required")

            self.client = OpenAI(api_key=api_key)

            logger.info("OpenAI Model connector initialized successfully")
        except ImportError:
            raise ImportError("openai is required. Install with: pip install openai")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute OpenAI Model action.

        Args:
            action_id: Action ID ('configure' or 'generate')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "configure":
            return self._execute_configure(inputs)
        elif action_id == "generate":
            return self._execute_generate(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_configure(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Configure model settings.

        Args:
            inputs: Configuration parameters (model, temperature, max_tokens)

        Returns:
            Dictionary with configured settings
        """
        if "model" in inputs:
            self.model_config["model"] = inputs["model"]
        if "temperature" in inputs:
            self.model_config["temperature"] = inputs["temperature"]
        if "max_tokens" in inputs:
            self.model_config["max_tokens"] = inputs["max_tokens"]

        logger.info(f"Model configured: {self.model_config}")

        return self.model_config.copy()

    def _execute_generate(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a response from the model.

        Args:
            inputs: Generation parameters (messages)

        Returns:
            Dictionary with response and usage
        """
        messages = inputs.get("messages")

        if not messages:
            raise ValueError("messages is required")

        logger.info(f"Generating response with {len(messages)} messages")

        try:
            response = self.client.chat.completions.create(
                model=self.model_config["model"],
                messages=messages,
                temperature=self.model_config["temperature"],
                max_tokens=self.model_config["max_tokens"],
            )

            result = {
                "response": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
            }

            logger.info(
                f"Response generated, tokens used: {result['usage']['total_tokens']}"
            )

            return result

        except Exception as e:
            error_msg = f"Failed to generate response: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
