"""
Supabase Realtime Connector implementation.

Provides trigger connector for Supabase database change events.
"""
from typing import Dict, Any
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from .realtime_client import SupabaseRealtimeClient
from .mapper import map_supabase_event

logger = get_logger(__name__)


class SupabaseConnector(BaseConnector):
    """
    Supabase Realtime Connector for database change events.
    
    Listens to Supabase Realtime events and triggers workflows.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Supabase connector.
        
        Args:
            config: Configuration containing supabase_url, supabase_key, table_name, etc.
        """
        super().__init__(config)
        self.realtime_client: SupabaseRealtimeClient = None
        self._event_callback = None
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os
        manifest_path = os.path.join(
            os.path.dirname(__file__),
            'manifest.json'
        )
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Supabase connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                'id': 'supabase_realtime',
                'name': 'Supabase Realtime',
                'version': '1.0.0',
                'description': 'Trigger workflows on Supabase database changes',
                'author': 'Bridge.dev',
                'connector_type': 'trigger'
            }
    
    def _initialize(self) -> None:
        """Initialize Supabase Realtime connection."""
        supabase_url = self.config.get('supabase_url')
        supabase_key = self.config.get('supabase_key')
        table_name = self.config.get('table_name')
        event_types = self.config.get('event_types', ['INSERT', 'UPDATE', 'DELETE'])
        filters = self.config.get('filters', {})
        
        if not supabase_url or not supabase_key or not table_name:
            raise ValueError(
                "supabase_url, supabase_key, and table_name are required in config"
            )
        
        # Create Realtime client (connection will be managed externally)
        self.realtime_client = SupabaseRealtimeClient(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            table_name=table_name,
            event_types=event_types,
            filters=filters,
            on_event=self._on_realtime_event
        )
        
        logger.info(
            f"Initialized Supabase connector for table {table_name}",
            extra={'table_name': table_name, 'event_types': event_types}
        )
    
    def _on_realtime_event(self, event_data: Dict[str, Any]):
        """
        Handle Realtime event callback.
        
        This is called by the Realtime client when an event occurs.
        The actual workflow triggering is handled by the trigger manager.
        
        Args:
            event_data: Event data from Supabase
        """
        if self._event_callback:
            # Map event to workflow payload format
            mapped_event = map_supabase_event(
                event_type=event_data.get('event_type'),
                table=event_data.get('table'),
                record=event_data.get('record'),
                old_record=event_data.get('old_record'),
                timestamp=event_data.get('timestamp')
            )
            self._event_callback(mapped_event)
    
    def set_event_callback(self, callback):
        """
        Set callback function for events.
        
        Args:
            callback: Function to call when events occur
        """
        self._event_callback = callback
    
    def connect(self):
        """Connect to Supabase Realtime."""
        if self.realtime_client:
            self.realtime_client.connect()
    
    def disconnect(self):
        """Disconnect from Supabase Realtime."""
        if self.realtime_client:
            self.realtime_client.disconnect()
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute connector action.
        
        Note: This is a trigger connector, so execute() is not typically called.
        Events are handled via the Realtime client callback.
        
        Args:
            action_id: Action ID (not used for triggers)
            inputs: Input data (not used for triggers)
            
        Returns:
            Empty dict (triggers don't return outputs)
        """
        logger.warning(
            "Supabase connector is a trigger connector, execute() should not be called"
        )
        return {}


