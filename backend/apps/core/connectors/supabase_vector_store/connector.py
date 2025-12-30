"""
Supabase Vector Store Connector implementation.

Provides vector search capabilities using Supabase pgvector.
"""

from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class SupabaseVectorConnector(BaseConnector):
    """
    Supabase Vector Store Connector for agent tools.

    Provides vector similarity search using pgvector extension.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Supabase Vector connector"""
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
        """Initialize Supabase client"""
        try:
            from supabase import create_client, Client

            supabase_url = self.config.get("supabase_url")
            supabase_key = self.config.get("supabase_key")

            if not supabase_url:
                raise ValueError("supabase_url is required")
            if not supabase_key:
                raise ValueError("supabase_key is required")

            self.client: Client = create_client(supabase_url, supabase_key)

            logger.info("Supabase Vector connector initialized successfully")
        except ImportError:
            raise ImportError(
                "supabase is required. Install with: pip install supabase"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Supabase Vector action.

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
        Execute vector search using pgvector.

        Args:
            inputs: Search parameters (query_vector, table_name, vector_column, limit)

        Returns:
            Dictionary with search results
        """
        query_vector = inputs.get("query_vector")
        table_name = inputs.get("table_name")
        vector_column = inputs.get("vector_column", "embedding")
        limit = inputs.get("limit", 10)

        if not query_vector:
            raise ValueError("query_vector is required")
        if not table_name:
            raise ValueError("table_name is required")

        logger.info(f"Executing vector search on table: {table_name}")

        try:
            # Use Supabase RPC for vector similarity search
            # Assumes you have a SQL function like match_documents
            response = self.client.rpc(
                "match_documents",
                {
                    "query_embedding": query_vector,
                    "match_threshold": 0.0,
                    "match_count": limit,
                },
            ).execute()

            results = response.data if response.data else []

            # Format results
            formatted_results = [
                {
                    "document": result,
                    "distance": result.get("distance", 0.0)
                    if isinstance(result, dict)
                    else 0.0,
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
        Insert row with vector.

        Args:
            inputs: Insert parameters (table_name, data)

        Returns:
            Dictionary with inserted row data
        """
        table_name = inputs.get("table_name")
        data = inputs.get("data")

        if not table_name:
            raise ValueError("table_name is required")
        if not data:
            raise ValueError("data is required")

        logger.info(f"Inserting row into table: {table_name}")

        try:
            response = self.client.table(table_name).insert(data).execute()

            inserted_data = response.data[0] if response.data else {}

            logger.info(f"Row inserted successfully")

            return {"id": str(inserted_data.get("id", "")), "data": inserted_data}

        except Exception as e:
            error_msg = f"Row insertion failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
