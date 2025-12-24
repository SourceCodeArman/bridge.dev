"""
Supabase Realtime client for listening to database changes.

Manages WebSocket connections to Supabase Realtime and handles reconnection logic.
"""
import threading
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from apps.common.logging_utils import get_logger

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger = get_logger(__name__)
    logger.warning("Supabase library not installed. Install with: pip install supabase")

logger = get_logger(__name__)


class SupabaseRealtimeClient:
    """
    Client for connecting to Supabase Realtime and listening to database changes.
    
    Handles connection lifecycle, reconnection, and event subscription.
    """
    
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        table_name: str,
        event_types: list = None,
        filters: Optional[Dict[str, Any]] = None,
        on_event: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        """
        Initialize Supabase Realtime client.
        
        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase API key (anon or service role)
            table_name: Table to listen to
            event_types: List of event types to listen for (INSERT, UPDATE, DELETE)
            filters: Optional column filters
            on_event: Callback function for events
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase library not installed. Install with: pip install supabase"
            )
        
        self.supabase_url = supabase_url.rstrip('/')
        self.supabase_key = supabase_key
        self.table_name = table_name
        self.event_types = event_types or ['INSERT', 'UPDATE', 'DELETE']
        self.filters = filters or {}
        self.on_event = on_event
        
        self.client: Optional[Client] = None
        self.channel = None
        self._connected = False
        self._should_reconnect = False
        self._lock = threading.Lock()
    
    def connect(self):
        """Connect to Supabase Realtime."""
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase library not installed")
        
        with self._lock:
            try:
                logger.info(
                    f"Connecting to Supabase Realtime for table {self.table_name}",
                    extra={
                        'table_name': self.table_name,
                        'supabase_url': self.supabase_url
                    }
                )
                
                # Create Supabase client
                self.client = create_client(self.supabase_url, self.supabase_key)
                
                # Subscribe to table changes via Realtime
                self.channel = self.client.realtime.channel(f"realtime:{self.table_name}")
                
                # Set up event handlers for each event type
                for event_type in self.event_types:
                    event_name = event_type.lower()
                    self.channel.on_postgres_changes(
                        event=event_name,
                        schema='public',
                        table=self.table_name,
                        callback=self._handle_event
                    )
                
                # Subscribe
                self.channel.subscribe()
                
                self._connected = True
                self._should_reconnect = True
                
                logger.info(
                    f"Connected to Supabase Realtime for table {self.table_name}",
                    extra={'table_name': self.table_name}
                )
                
            except Exception as e:
                logger.error(
                    f"Failed to connect to Supabase Realtime: {str(e)}",
                    exc_info=e,
                    extra={
                        'table_name': self.table_name,
                        'supabase_url': self.supabase_url
                    }
                )
                self._connected = False
                raise
    
    def _handle_event(self, payload: Dict[str, Any]):
        """
        Handle incoming Realtime event.
        
        Args:
            payload: Event payload from Supabase
        """
        try:
            # Supabase Realtime payload structure
            event_type = payload.get('eventType', '').upper()
            new_record = payload.get('new', {})
            old_record = payload.get('old', {})
            
            # Determine event type from payload if not explicit
            if not event_type:
                if new_record and not old_record:
                    event_type = 'INSERT'
                elif new_record and old_record:
                    event_type = 'UPDATE'
                elif old_record and not new_record:
                    event_type = 'DELETE'
            
            # Use new record for filtering (or old for DELETE)
            record_to_filter = new_record if new_record else old_record
            
            # Apply filters if specified
            from .mapper import apply_filters
            if not apply_filters(record_to_filter, self.filters):
                logger.debug(
                    f"Event filtered out for table {self.table_name}",
                    extra={'table_name': self.table_name, 'event_type': event_type}
                )
                return
            
            # Call event handler
            if self.on_event:
                event_data = {
                    'event_type': event_type,
                    'table': self.table_name,
                    'record': new_record if new_record else None,
                    'old_record': old_record if old_record else None,
                    'timestamp': datetime.utcnow()
                }
                self.on_event(event_data)
            
        except Exception as e:
            logger.error(
                f"Error handling Supabase Realtime event: {str(e)}",
                exc_info=e,
                extra={'table_name': self.table_name}
            )
    
    def disconnect(self):
        """Disconnect from Supabase Realtime."""
        with self._lock:
            self._should_reconnect = False
            
            try:
                if self.channel:
                    self.channel.unsubscribe()
                    self.channel = None
                
                if self.client:
                    # Supabase client cleanup if needed
                    self.client = None
                
                self._connected = False
                
                logger.info(
                    f"Disconnected from Supabase Realtime for table {self.table_name}",
                    extra={'table_name': self.table_name}
                )
                
            except Exception as e:
                logger.error(
                    f"Error disconnecting from Supabase Realtime: {str(e)}",
                    exc_info=e,
                    extra={'table_name': self.table_name}
                )
    
    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._connected
    
    def reconnect(self):
        """Reconnect to Supabase Realtime."""
        if self._connected:
            self.disconnect()
        
        import time
        max_retries = 5
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                self.connect()
                return
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Reconnection attempt {attempt + 1} failed, retrying in {retry_delay}s",
                        extra={
                            'table_name': self.table_name,
                            'attempt': attempt + 1,
                            'error': str(e)
                        }
                    )
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(
                        f"Failed to reconnect after {max_retries} attempts",
                        exc_info=e,
                        extra={'table_name': self.table_name}
                    )
                    raise

