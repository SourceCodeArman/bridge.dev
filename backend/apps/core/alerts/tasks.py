"""
Celery tasks for alert system.
"""
from celery import shared_task
from django.utils import timezone
from apps.common.logging_utils import get_logger
from apps.core.models import Run, AlertConfiguration
from .throttler import AlertThrottler
from .notifiers import EmailNotifier, SlackNotifier, WebhookNotifier

logger = get_logger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30
)
def send_alert_task(self, alert_config_id: str, run_id: str, alert_type: str):
    """
    Send alert for a workflow run.
    
    Args:
        alert_config_id: UUID string of AlertConfiguration
        run_id: UUID string of Run
        alert_type: Type of alert ('failure' or 'timeout')
        
    Returns:
        str: Success message
    """
    try:
        alert_config = AlertConfiguration.objects.get(id=alert_config_id)
        run = Run.objects.get(id=run_id)
        
        # Check throttling
        if AlertThrottler.should_throttle(alert_config, alert_type):
            # Record throttled alert for each channel
            channels = alert_config.notification_channels
            for channel in channels:
                AlertThrottler.record_throttled_alert(
                    alert_config,
                    run,
                    alert_type,
                    channel
                )
            return f"Alert throttled for run {run_id}"
        
        # Send alerts via configured channels
        channels = alert_config.notification_channels
        sent_count = 0
        
        for channel in channels:
            try:
                if channel == 'email':
                    EmailNotifier.send(alert_config, run, alert_type)
                    sent_count += 1
                elif channel == 'slack':
                    SlackNotifier.send(alert_config, run, alert_type)
                    sent_count += 1
                elif channel == 'webhook':
                    WebhookNotifier.send(alert_config, run, alert_type)
                    sent_count += 1
                else:
                    logger.warning(
                        f"Unknown notification channel: {channel}",
                        extra={'channel': channel, 'alert_config_id': alert_config_id}
                    )
            except Exception as e:
                logger.error(
                    f"Failed to send alert via {channel} for run {run_id}: {str(e)}",
                    exc_info=e,
                    extra={
                        'channel': channel,
                        'run_id': run_id,
                        'alert_type': alert_type,
                        'error': str(e)
                    }
                )
                # Continue with other channels even if one fails
        
        logger.info(
            f"Alert sending completed for run {run_id}",
            extra={
                'run_id': run_id,
                'alert_type': alert_type,
                'channels_attempted': len(channels),
                'channels_sent': sent_count
            }
        )
        
        return f"Alert sent for run {run_id} via {sent_count} channel(s)"
        
    except AlertConfiguration.DoesNotExist:
        logger.error(f"Alert configuration {alert_config_id} not found")
        raise
    except Run.DoesNotExist:
        logger.error(f"Run {run_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error sending alert for run {run_id}: {str(exc)}",
            exc_info=exc,
            extra={'run_id': run_id, 'alert_type': alert_type}
        )
        raise self.retry(countdown=30 * (2 ** self.request.retries), exc=exc)

