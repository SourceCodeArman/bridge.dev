"""
Event mapper for Supabase Realtime events.

Maps Supabase Realtime database change events to workflow payload format.
"""
from typing import Dict, Any, Optional
from datetime import datetime
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


def map_supabase_event(
    event_type: str,
    table: str,
    record: Optional[Dict[str, Any]] = None,
    old_record: Optional[Dict[str, Any]] = None,
    timestamp: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Map Supabase Realtime event to workflow payload format.
    
    Args:
        event_type: Event type (INSERT, UPDATE, DELETE)
        table: Table name
        record: New record data (for INSERT/UPDATE)
        old_record: Previous record data (for UPDATE/DELETE)
        timestamp: Event timestamp
        
    Returns:
        Dictionary in workflow payload format
    """
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    payload = {
        'event_type': event_type,
        'table': table,
        'timestamp': timestamp.isoformat() + 'Z'
    }
    
    if record is not None:
        payload['record'] = record
    
    if old_record is not None:
        payload['old_record'] = old_record
    
    logger.debug(
        f"Mapped Supabase event: {event_type} on {table}",
        extra={
            'event_type': event_type,
            'table': table,
            'has_record': record is not None,
            'has_old_record': old_record is not None
        }
    )
    
    return payload


def apply_filters(record: Dict[str, Any], filters: Optional[Dict[str, Any]]) -> bool:
    """
    Check if a record matches the specified filters.
    
    Args:
        record: Record data to check
        filters: Filter criteria (column: value pairs)
        
    Returns:
        True if record matches filters, False otherwise
    """
    if not filters:
        return True
    
    for column, value in filters.items():
        if column not in record:
            return False
        if record[column] != value:
            return False
    
    return True


