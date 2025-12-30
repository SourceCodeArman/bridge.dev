"""
Redis Memory Connector implementation.

Provides Redis-based chat memory storage.
"""

from typing import Dict, Any
from datetime import datetime
import json
import uuid
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class RedisMemoryConnector(BaseConnector):
    """
    Redis Memory Connector for agent memory.

    Stores and retrieves conversation history using Redis lists.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Redis Memory connector"""
        super().__init__(config)
        self.redis_client = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize Redis connection"""
        try:
            import redis

            redis_url = self.config.get("redis_url")

            if not redis_url:
                raise ValueError("redis_url is required")

            self.redis_client = redis.from_url(redis_url, decode_responses=True)

            # Test connection
            self.redis_client.ping()

            logger.info("Redis Memory connector initialized successfully")
        except ImportError:
            raise ImportError("redis is required. Install with: pip install redis")
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Redis Memory action.

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
            message_id = str(uuid.uuid4())

            message = {
                "message_id": message_id,
                "role": role,
                "content": content,
                "metadata": metadata,
                "timestamp": timestamp.isoformat(),
            }

            # Store as JSON string in Redis list
            key = f"conversation:{conversation_id}:messages"
            self.redis_client.rpush(key, json.dumps(message))

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
            key = f"conversation:{conversation_id}:messages"

            # Get messages from Redis list (latest N messages)
            # Use lrange to get all messages, then limit in Python
            message_strings = self.redis_client.lrange(key, 0, -1)

            # Parse JSON messages
            messages = []
            for msg_str in message_strings[-limit:]:  # Get last N messages
                try:
                    messages.append(json.loads(msg_str))
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse message: {msg_str}")
                    continue

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
            key = f"conversation:{conversation_id}:messages"

            # Get count before deleting
            deleted_count = self.redis_client.llen(key)

            # Delete the list
            self.redis_client.delete(key)

            logger.info(f"Deleted {deleted_count} messages")

            return {"deleted_count": deleted_count}

        except Exception as e:
            error_msg = f"Failed to clear history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def __del__(self):
        """Cleanup: close Redis connection"""
        if self.redis_client:
            self.redis_client.close()
            logger.info("Redis connection closed")
