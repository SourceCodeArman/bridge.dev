"""
Supabase Realtime trigger handler.

Manages Supabase Realtime connections for workflow triggers and handles event processing.
"""
import threading
from typing import Dict, Any
from apps.common.logging_utils import get_logger
from .models import Trigger
from .orchestrator import RunOrchestrator
from .tasks import execute_workflow_run
from .encryption import get_encryption_service
from .connectors.supabase import SupabaseConnector

logger = get_logger(__name__)


class SupabaseTriggerManager:
    """
    Manager for Supabase Realtime trigger connections.
    
    Maintains active connections and routes events to workflows.
    """
    
    _instance = None
    _lock = threading.Lock()
    _connections: Dict[str, SupabaseConnector] = {}
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def activate_trigger(self, trigger: Trigger) -> bool:
        """
        Activate a Supabase Realtime trigger.
        
        Args:
            trigger: Trigger instance to activate
            
        Returns:
            True if activated successfully, False otherwise
        """
        if trigger.trigger_type != 'supabase_realtime':
            logger.warning(
                f"Trigger {trigger.id} is not a Supabase Realtime trigger",
                extra={'trigger_id': str(trigger.id)}
            )
            return False
        
        if str(trigger.id) in self._connections:
            logger.info(
                f"Trigger {trigger.id} is already active",
                extra={'trigger_id': str(trigger.id)}
            )
            return True
        
        try:
            config = trigger.config
            credential_id = config.get('credential_id')
            
            if not credential_id:
                logger.error(
                    f"Trigger {trigger.id} missing credential_id in config",
                    extra={'trigger_id': str(trigger.id)}
                )
                return False
            
            # Get credential and decrypt
            from .models import Credential
            try:
                credential = Credential.objects.get(id=credential_id)
                encryption_service = get_encryption_service()
                credential_data = encryption_service.decrypt_dict(credential.encrypted_data)
            except Credential.DoesNotExist:
                logger.error(
                    f"Credential {credential_id} not found for trigger {trigger.id}",
                    extra={'trigger_id': str(trigger.id), 'credential_id': credential_id}
                )
                return False
            
            # Build connector config
            connector_config = {
                'supabase_url': config.get('supabase_url') or credential_data.get('supabase_url'),
                'supabase_key': credential_data.get('supabase_key') or credential_data.get('api_key'),
                'table_name': config.get('table_name'),
                'event_types': config.get('event_types', ['INSERT', 'UPDATE', 'DELETE']),
                'filters': config.get('filters', {})
            }
            
            # Create connector instance
            connector = SupabaseConnector(connector_config)
            connector.initialize()
            
            # Set event callback
            def on_event(event_data: Dict[str, Any]):
                self._handle_event(trigger, event_data)
            
            connector.set_event_callback(on_event)
            
            # Connect
            connector.connect()
            
            # Store connection
            self._connections[str(trigger.id)] = connector
            
            logger.info(
                f"Activated Supabase Realtime trigger {trigger.id}",
                extra={
                    'trigger_id': str(trigger.id),
                    'workflow_id': str(trigger.workflow.id),
                    'table_name': connector_config.get('table_name')
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to activate Supabase Realtime trigger {trigger.id}: {str(e)}",
                exc_info=e,
                extra={'trigger_id': str(trigger.id)}
            )
            return False
    
    def deactivate_trigger(self, trigger_id: str) -> bool:
        """
        Deactivate a Supabase Realtime trigger.
        
        Args:
            trigger_id: Trigger ID to deactivate
            
        Returns:
            True if deactivated successfully, False otherwise
        """
        connector = self._connections.get(trigger_id)
        if not connector:
            logger.warning(
                f"Trigger {trigger_id} is not active",
                extra={'trigger_id': trigger_id}
            )
            return False
        
        try:
            connector.disconnect()
            del self._connections[trigger_id]
            
            logger.info(
                f"Deactivated Supabase Realtime trigger {trigger_id}",
                extra={'trigger_id': trigger_id}
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to deactivate Supabase Realtime trigger {trigger_id}: {str(e)}",
                exc_info=e,
                extra={'trigger_id': trigger_id}
            )
            return False
    
    def _handle_event(self, trigger: Trigger, event_data: Dict[str, Any]):
        """
        Handle Supabase Realtime event and trigger workflow.
        
        Args:
            trigger: Trigger instance
            event_data: Event data from Supabase
        """
        try:
            # Get active workflow version
            workflow_version = trigger.workflow.get_active_version()
            if not workflow_version:
                logger.warning(
                    f"Workflow {trigger.workflow.id} has no active version",
                    extra={'workflow_id': str(trigger.workflow.id), 'trigger_id': str(trigger.id)}
                )
                return
            
            # Create workflow run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type='event',
                input_data=event_data,
                idempotency_key=f"supabase_{trigger.id}_{event_data.get('timestamp', '')}"
            )
            
            # Execute workflow
            execute_workflow_run.delay(str(run.id))
            
            logger.info(
                f"Triggered workflow run {run.id} from Supabase event",
                extra={
                    'run_id': str(run.id),
                    'trigger_id': str(trigger.id),
                    'workflow_id': str(trigger.workflow.id),
                    'event_type': event_data.get('event_type')
                }
            )
            
        except Exception as e:
            logger.error(
                f"Error handling Supabase event for trigger {trigger.id}: {str(e)}",
                exc_info=e,
                extra={
                    'trigger_id': str(trigger.id),
                    'workflow_id': str(trigger.workflow.id)
                }
            )
    
    def activate_all_active_triggers(self):
        """Activate all active Supabase Realtime triggers."""
        triggers = Trigger.objects.filter(
            trigger_type='supabase_realtime',
            is_active=True
        ).select_related('workflow')
        
        activated = 0
        for trigger in triggers:
            if self.activate_trigger(trigger):
                activated += 1
        
        logger.info(
            f"Activated {activated} Supabase Realtime triggers",
            extra={'activated_count': activated, 'total_triggers': triggers.count()}
        )
    
    def get_active_connections(self) -> Dict[str, Any]:
        """Get information about active connections."""
        return {
            trigger_id: {
                'is_connected': connector.realtime_client.is_connected if connector.realtime_client else False,
                'table_name': connector.config.get('table_name') if connector else None
            }
            for trigger_id, connector in self._connections.items()
        }


# Global manager instance
trigger_manager = SupabaseTriggerManager()


