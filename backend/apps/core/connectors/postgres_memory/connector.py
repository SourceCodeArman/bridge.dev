"""
Postgres Memory Connector implementation.

Provides PostgreSQL-based chat memory storage.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class PostgresMemoryConnector(BaseConnector):
    """
    Postgres Memory Connector for agent memory.

    Stores and retrieves conversation history using PostgreSQL.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Postgres Memory connector"""
        super().__init__(config)
        self.connection = None
        self.cursor = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize PostgreSQL connection"""
        try:
            import psycopg2

            connection_string = self.config.get("connection_string")
            if not connection_string:
                raise ValueError("connection_string is required")

            self.connection = psycopg2.connect(connection_string)
            self.cursor = self.connection.cursor()

            # Create messages table if it doesn't exist
            create_table_query = """
            CREATE TABLE IF NOT EXISTS conversation_messages (
                message_id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_conversation_id (conversation_id),
                INDEX idx_timestamp (timestamp)
            );
            """
            self.cursor.execute(create_table_query)
            self.connection.commit()

            logger.info("Postgres Memory connector initialized successfully")
        except ImportError:
            raise ImportError(
                "psycopg2 is required. Install with: pip install psycopg2-binary"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Postgres connection: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Postgres Memory action.

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
        import json

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
            query = """
            INSERT INTO conversation_messages (conversation_id, role, content, metadata)
            VALUES (%s, %s, %s, %s)
            RETURNING message_id, timestamp;
            """

            self.cursor.execute(
                query, (conversation_id, role, content, json.dumps(metadata))
            )
            result = self.cursor.fetchone()
            self.connection.commit()

            message_id, timestamp = result

            logger.info(f"Message saved with ID: {message_id}")

            return {"message_id": str(message_id), "timestamp": timestamp.isoformat()}

        except Exception as e:
            self.connection.rollback()
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
            query = """
            SELECT message_id, role, content, metadata, timestamp
            FROM conversation_messages
            WHERE conversation_id = %s
            ORDER BY timestamp ASC
            LIMIT %s;
            """

            self.cursor.execute(query, (conversation_id, limit))
            rows = self.cursor.fetchall()

            messages = [
                {
                    "message_id": str(row[0]),
                    "role": row[1],
                    "content": row[2],
                    "metadata": row[3] if row[3] else {},
                    "timestamp": row[4].isoformat(),
                }
                for row in rows
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
            query = """
            DELETE FROM conversation_messages
            WHERE conversation_id = %s;
            """

            self.cursor.execute(query, (conversation_id,))
            deleted_count = self.cursor.rowcount
            self.connection.commit()

            logger.info(f"Deleted {deleted_count} messages")

            return {"deleted_count": deleted_count}

        except Exception as e:
            self.connection.rollback()
            error_msg = f"Failed to clear history: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def __del__(self):
        """Cleanup: close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            logger.info("Postgres connection closed")
