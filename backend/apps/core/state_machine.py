"""
State machine for workflow run and step lifecycle management.

Defines valid state transitions and provides transition validation.
"""
from django.utils import timezone
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class RunStateMachine:
    """State machine for Run model status transitions"""
    
    # Valid state transitions
    TRANSITIONS = {
        'pending': ['running', 'cancelled'],
        'running': ['completed', 'failed', 'cancelled'],
        'completed': [],  # Terminal state
        'failed': [],     # Terminal state
        'cancelled': [],  # Terminal state
    }
    
    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        """
        Check if a state transition is valid.
        
        Args:
            from_status: Current status
            to_status: Target status
            
        Returns:
            True if transition is valid, False otherwise
        """
        valid_transitions = cls.TRANSITIONS.get(from_status, [])
        return to_status in valid_transitions
    
    @classmethod
    def get_valid_transitions(cls, current_status: str) -> list:
        """Get list of valid next states from current status"""
        return cls.TRANSITIONS.get(current_status, [])


class RunStepStateMachine:
    """State machine for RunStep model status transitions"""
    
    # Valid state transitions
    TRANSITIONS = {
        'pending': ['running', 'skipped'],
        'running': ['completed', 'failed'],
        'completed': [],  # Terminal state
        'failed': [],     # Terminal state
        'skipped': [],    # Terminal state
    }
    
    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        """
        Check if a state transition is valid.
        
        Args:
            from_status: Current status
            to_status: Target status
            
        Returns:
            True if transition is valid, False otherwise
        """
        valid_transitions = cls.TRANSITIONS.get(from_status, [])
        return to_status in valid_transitions
    
    @classmethod
    def get_valid_transitions(cls, current_status: str) -> list:
        """Get list of valid next states from current status"""
        return cls.TRANSITIONS.get(current_status, [])


def log_state_transition(instance, from_status: str, to_status: str, metadata: dict = None):
    """
    Log a state transition for audit purposes.
    
    Args:
        instance: The model instance (Run or RunStep)
        from_status: Previous status
        to_status: New status
        metadata: Additional metadata to log
    """
    model_name = instance.__class__.__name__
    instance_id = str(instance.id)
    
    log_data = {
        'model': model_name,
        'instance_id': instance_id,
        'from_status': from_status,
        'to_status': to_status,
        'timestamp': timezone.now().isoformat(),
    }
    
    if metadata:
        log_data.update(metadata)
    
    logger.info(
        f"{model_name} {instance_id} transition: {from_status} -> {to_status}",
        extra=log_data
    )

