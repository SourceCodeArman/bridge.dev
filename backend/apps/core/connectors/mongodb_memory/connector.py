"""
MongoDB Memory Connector implementation.

Provides MongoDB-based chat memory storage.
"""

from typing import Dict, Any
from datetime import datetime
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class MongoDBMemoryConnector(BaseConnector):
    """
    MongoDB Memory Connector for agent memory.

    Stores and retrieves conversation history using MongoDB.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize MongoDB Memory connector"""
        super().__init__(config)
        self.client = None
        self.db = None
        self.collection = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize MongoDB connection"""
        try:
            from pymongo import MongoClient

            connection_string = self.config.get("connection_string")
            database_name = self.config.get("database_name")

            if not connection_string:
                raise ValueError("connection_string is required")

            self.client = MongoClient(connection_string)

            # Use provided database name or get default from connection string
            if database_name:
                self.db = self.client[database_name]
            else:
                self.db = self.client.get_default_database()

            self.collection = self.db["conversation_messages"]

            # Create indexes for efficient querying
            self.collection.create_index([("conversation_id", 1), ("timestamp", 1)])

            logger.info("MongoDB Memory connector initialized successfully")
        except ImportError:
            raise ImportError("pymongo is required. Install with: pip install pymongo")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB connection: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute MongoDB Memory action.

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

            document = {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": metadata,
                "timestamp": timestamp,
            }

            result = self.collection.insert_one(document)
            message_id = str(result.inserted_id)

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
            cursor = (
                self.collection.find({"conversation_id": conversation_id})
                .sort("timestamp", 1)
                .limit(limit)
            )

            messages = []
            for doc in cursor:
                messages.append(
                    {
                        "message_id": str(doc["_id"]),
                        "role": doc.get("role"),
                        "content": doc.get("content"),
                        "metadata": doc.get("metadata", {}),
                        "timestamp": doc.get("timestamp").isoformat()
                        if doc.get("timestamp")
                        else None,
                    }
                )

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
            result = self.collection.delete_many({"conversation_id": conversation_id})
            deleted_count = result.deleted_count

            logger.info(f"Deleted {deleted_count} messages")

            return {"deleted_count": deleted_count}

        except Exception as e:
            error_msg = f"Failed to clear history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def __del__(self):
        """Cleanup: close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")
