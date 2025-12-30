"""
MongoDB Atlas Vector Store Connector implementation.

Provides vector search capabilities using MongoDB Atlas Vector Search.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class MongoDBAtlasVectorConnector(BaseConnector):
    """
    MongoDB Atlas Vector Store Connector for agent tools.

    Provides vector similarity search capabilities using MongoDB Atlas.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize MongoDB Atlas Vector connector"""
        super().__init__(config)
        self.client = None
        self.db = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize MongoDB Atlas client"""
        try:
            from pymongo import MongoClient

            connection_string = self.config.get("connection_string")
            if not connection_string:
                raise ValueError("connection_string is required")

            self.client = MongoClient(connection_string)
            # Extract database name from connection string or use default
            self.db = self.client.get_default_database()

            logger.info("MongoDB Atlas Vector connector initialized successfully")
        except ImportError:
            raise ImportError("pymongo is required. Install with: pip install pymongo")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB Atlas client: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute MongoDB Atlas Vector action.

        Args:
            action_id: Action ID ('search' or 'insert')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "search":
            return self._execute_search(inputs)
        elif action_id == "insert":
            return self._execute_insert(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_search(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute vector search.

        Args:
            inputs: Search parameters (query_vector, index_name, limit, num_candidates)

        Returns:
            Dictionary with search results
        """
        query_vector = inputs.get("query_vector")
        index_name = inputs.get("index_name")
        limit = inputs.get("limit", 10)
        num_candidates = inputs.get("num_candidates", 100)

        if not query_vector:
            raise ValueError("query_vector is required")
        if not index_name:
            raise ValueError("index_name is required")

        logger.info(f"Executing vector search with index: {index_name}")

        try:
            # MongoDB Atlas Vector Search aggregation pipeline
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": index_name,
                        "path": "embedding",
                        "queryVector": query_vector,
                        "numCandidates": num_candidates,
                        "limit": limit,
                    }
                },
                {
                    "$project": {
                        "document": "$$ROOT",
                        "score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]

            # Execute search - note: collection name should be passed or configured
            collection_name = inputs.get("collection", "vectors")
            collection = self.db[collection_name]

            results = list(collection.aggregate(pipeline))

            # Format results
            formatted_results = [
                {
                    "document": result.get("document", {}),
                    "score": result.get("score", 0.0),
                }
                for result in results
            ]

            logger.info(f"Vector search returned {len(formatted_results)} results")

            return {"results": formatted_results, "count": len(formatted_results)}

        except Exception as e:
            error_msg = f"Vector search failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def _execute_insert(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert document with vector.

        Args:
            inputs: Insert parameters (collection, document)

        Returns:
            Dictionary with inserted_id
        """
        collection_name = inputs.get("collection")
        document = inputs.get("document")

        if not collection_name:
            raise ValueError("collection is required")
        if not document:
            raise ValueError("document is required")

        logger.info(f"Inserting document into collection: {collection_name}")

        try:
            collection = self.db[collection_name]
            result = collection.insert_one(document)

            logger.info(f"Document inserted with ID: {result.inserted_id}")

            return {"inserted_id": str(result.inserted_id)}

        except Exception as e:
            error_msg = f"Document insertion failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
