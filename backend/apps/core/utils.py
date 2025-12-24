"""
Utility functions for workflow orchestration.
"""
import hashlib
import json
from typing import Dict, Any, Optional
from uuid import UUID
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


def generate_idempotency_key(
    trigger_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    timestamp: Optional[str] = None
) -> str:
    """
    Generate an idempotency key for workflow runs.
    
    Args:
        trigger_id: Optional trigger ID
        payload: Optional payload dictionary
        timestamp: Optional timestamp string (defaults to current time if not provided)
        
    Returns:
        Hexadecimal hash string to use as idempotency key
    """
    import time
    from django.utils import timezone
    
    # Build key components
    components = []
    
    if trigger_id:
        components.append(str(trigger_id))
    
    if payload:
        # Sort keys and convert to JSON for consistent hashing
        payload_str = json.dumps(payload, sort_keys=True)
        components.append(payload_str)
    
    if timestamp:
        components.append(str(timestamp))
    else:
        components.append(str(int(timezone.now().timestamp())))
    
    # Create hash
    key_string = '|'.join(components)
    hash_obj = hashlib.sha256(key_string.encode('utf-8'))
    idempotency_key = hash_obj.hexdigest()
    
    logger.debug(
        f"Generated idempotency key: {idempotency_key[:16]}...",
        extra={'idempotency_key_prefix': idempotency_key[:16]}
    )
    
    return idempotency_key


def validate_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
    algorithm: str = 'sha256'
) -> bool:
    """
    Validate webhook signature.
    
    Args:
        payload: Raw request payload bytes
        signature: Signature header value
        secret: Secret key for validation
        algorithm: Hash algorithm to use (default: sha256)
        
    Returns:
        True if signature is valid, False otherwise
    """
    import hmac
    
    if algorithm == 'sha256':
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Handle both hex and base64 encoded signatures
        if signature.startswith('sha256='):
            signature = signature[7:]
        
        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(expected_signature, signature)
    
    raise ValueError(f"Unsupported algorithm: {algorithm}")


def parse_cron_expression(cron_expr: str) -> Dict[str, Any]:
    """
    Parse and validate a cron expression.
    
    Args:
        cron_expr: Cron expression string (e.g., "0 * * * *")
        
    Returns:
        Dictionary with parsed cron components
        
    Raises:
        ValueError: If cron expression is invalid
    """
    try:
        import croniter
        from datetime import datetime
        
        # Validate cron expression
        cron = croniter.croniter(cron_expr, datetime.now())
        
        # Get next and previous execution times
        next_time = cron.get_next(datetime)
        prev_time = cron.get_prev(datetime)
        
        return {
            'expression': cron_expr,
            'next_execution': next_time.isoformat(),
            'previous_execution': prev_time.isoformat(),
            'valid': True
        }
    except Exception as e:
        raise ValueError(f"Invalid cron expression '{cron_expr}': {str(e)}")

