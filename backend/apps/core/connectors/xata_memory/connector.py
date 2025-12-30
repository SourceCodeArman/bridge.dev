"""
Xata Memory Connector implementation.

Provides Xata database-based chat memory storage.
"""

from typing import Dict, Any
from datetime import datetime
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class XataMemoryConnector(BaseConnector):
    """
    Xata Memory Connector for agent memory.

    Stores and retrieves conversation history using Xata database.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Xata Memory connector"""
        super().__init__(config)
        self.client = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize Xata client"""
        try:
            from xata.client import XataClient

            api_key = self.config.get("api_key")
            database_url = self.config.get("database_url")

            if not api_key:
                raise ValueError("api_key is required")
            if not database_url:
                raise ValueError("database_url is required")

            self.client = XataClient(api_key=api_key, db_url=database_url)

            logger.info("Xata Memory connector initialized successfully")
        except ImportError:
            raise ImportError("xata is required. Install with: pip install xata")
        except Exception as e:
            logger.error(f"Failed to initialize Xata client: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Xata Memory action.

        Args:
            action_id: Action ID ('save_message', 'get_history', 'clear')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "save_message":
            return self._execute_save_message(inputs)
        elif action_id == "get_history":
            return self._execute_get_history(inputs)
        elif action_id == "clear":
            return self._execute_clear(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_save_message(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save a message to conversation history.

        Args:
            inputs: Message parameters (conversation_id, role, content, metadata)

        Returns:
            Dictionary with message_id and timestamp
        """
        conversation_id = inputs.get("conversation_id")
        role = inputs.get("role")
        content = inputs.get("content")
        metadata = inputs.get("metadata", {})

        if not conversation_id:
            raise ValueError("conversation_id is required")
        if not role:
            raise ValueError("role is required")
        if not content:
            raise ValueError("content is required")

        logger.info(f"Saving message to conversation: {conversation_id}")

        try:
            timestamp = datetime.utcnow()

            record = {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": metadata,
                "timestamp": timestamp.isoformat(),
            }

            result = self.client.records().create("conversation_messages", record)
            message_id = result.get("id")

            logger.info(f"Message saved with ID: {message_id}")

            return {"message_id": message_id, "timestamp": timestamp.isoformat()}

        except Exception as e:
            error_msg = f"Failed to save message: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def _execute_get_history(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieve conversation history.

        Args:
            inputs: Query parameters (conversation_id, limit)

        Returns:
            Dictionary with messages array
        """
        conversation_id = inputs.get("conversation_id")
        limit = inputs.get("limit", 100)

        if not conversation_id:
            raise ValueError("conversation_id is required")

        logger.info(f"Retrieving history for conversation: {conversation_id}")

        try:
            # Query with filter and sort
            result = self.client.data().query(
                "conversation_messages",
                {
                    "filter": {"conversation_id": conversation_id},
                    "sort": {"timestamp": "asc"},
                    "page": {"size": limit},
                },
            )

            records = result.get("records", [])

            messages = [
                {
                    "message_id": record.get("id"),
                    "role": record.get("role"),
                    "content": record.get("content"),
                    "metadata": record.get("metadata", {}),
                    "timestamp": record.get("timestamp"),
                }
                for record in records
            ]

            logger.info(f"Retrieved {len(messages)} messages")

            return {"messages": messages, "count": len(messages)}

        except Exception as e:
            error_msg = f"Failed to retrieve history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def _execute_clear(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clear conversation history.

        Args:
            inputs: Clear parameters (conversation_id)

        Returns:
            Dictionary with deleted_count
        """
        conversation_id = inputs.get("conversation_id")

        if not conversation_id:
            raise ValueError("conversation_id is required")

        logger.info(f"Clearing history for conversation: {conversation_id}")

        try:
            # First, get all records for this conversation
            result = self.client.data().query(
                "conversation_messages",
                {"filter": {"conversation_id": conversation_id}},
            )

            records = result.get("records", [])

            # Delete each record
            deleted_count = 0
            for record in records:
                self.client.records().delete("conversation_messages", record.get("id"))
                deleted_count += 1

            logger.info(f"Deleted {deleted_count} messages")

            return {"deleted_count": deleted_count}

        except Exception as e:
            error_msg = f"Failed to clear history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
