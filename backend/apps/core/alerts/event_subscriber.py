"""
Event subscriber for alert system.

Listens for run failures and timeouts and triggers alert sending.
"""
from apps.common.logging_utils import get_logger
from apps.core.models import Run, AlertConfiguration
from .tasks import send_alert_task

logger = get_logger(__name__)


class AlertEventSubscriber:
    """
    Subscribes to workflow run events and triggers alerts.
    """
    
    @staticmethod
    def on_run_failure(run: Run) -> None:
        """
        Handle run failure event.
        
        Args:
            run: The failed Run instance
        """
        logger.info(
            f"Run failure event for run {run.id}",
            extra={'run_id': str(run.id), 'workflow_id': str(run.workflow_version.workflow.id)}
        )
        
        workflow = run.workflow_version.workflow
        
        # Get enabled alert configurations for this workflow
        alert_configs = AlertConfiguration.objects.filter(
            workflow=workflow,
            enabled=True,
            alert_on_failure=True
        )
        
        for alert_config in alert_configs:
            # Trigger alert sending asynchronously
            send_alert_task.delay(str(alert_config.id), str(run.id), 'failure')
    
    @staticmethod
    def on_run_timeout(run: Run) -> None:
        """
        Handle run timeout event.
        
        Args:
            run: The timed-out Run instance
        """
        logger.info(
            f"Run timeout event for run {run.id}",
            extra={'run_id': str(run.id), 'workflow_id': str(run.workflow_version.workflow.id)}
        )
        
        workflow = run.workflow_version.workflow
        
        # Get enabled alert configurations for this workflow
        alert_configs = AlertConfiguration.objects.filter(
            workflow=workflow,
            enabled=True,
            alert_on_timeout=True
        )
        
        for alert_config in alert_configs:
            # Trigger alert sending asynchronously
            send_alert_task.delay(str(alert_config.id), str(run.id), 'timeout')

