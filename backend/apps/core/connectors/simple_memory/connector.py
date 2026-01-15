"""
Simple Memory Connector implementation.

Provides in-app database-backed chat memory storage.
No external authentication required.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class SimpleMemoryConnector(BaseConnector):
    """
    Simple Memory Connector for agent memory.

    Stores and retrieves conversation history using Bridge.dev's database.
    No external authentication required.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Simple Memory connector"""
        super().__init__(config)

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize connector - no external connection needed"""
        logger.info("Simple Memory connector initialized successfully")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Simple Memory action.

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
        from apps.core.models import AgentMemoryMessage

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
            message = AgentMemoryMessage.objects.create(
                conversation_id=conversation_id,
                role=role,
                content=content,
                metadata=metadata,
            )

            logger.info(f"Message saved with ID: {message.id}")

            return {
                "message_id": str(message.id),
                "timestamp": message.created_at.isoformat(),
            }

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
        from apps.core.models import AgentMemoryMessage

        conversation_id = inputs.get("conversation_id")
        limit = inputs.get("limit", 100)

        if not conversation_id:
            raise ValueError("conversation_id is required")

        logger.info(f"Retrieving history for conversation: {conversation_id}")

        try:
            messages = AgentMemoryMessage.objects.filter(
                conversation_id=conversation_id
            ).order_by("created_at")[:limit]

            result = []
            for msg in messages:
                result.append(
                    {
                        "message_id": str(msg.id),
                        "role": msg.role,
                        "content": msg.content,
                        "timestamp": msg.created_at.isoformat(),
                        "metadata": msg.metadata or {},
                    }
                )

            logger.info(f"Retrieved {len(result)} messages")

            return {"messages": result, "count": len(result)}

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
        from apps.core.models import AgentMemoryMessage

        conversation_id = inputs.get("conversation_id")

        if not conversation_id:
            raise ValueError("conversation_id is required")

        logger.info(f"Clearing history for conversation: {conversation_id}")

        try:
            deleted_count, _ = AgentMemoryMessage.objects.filter(
                conversation_id=conversation_id
            ).delete()

            logger.info(f"Deleted {deleted_count} messages")

            return {"deleted_count": deleted_count}

        except Exception as e:
            error_msg = f"Failed to clear history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
