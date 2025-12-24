"""
Throttling logic for alert system.

Prevents alert spam by tracking recent alert history.
"""
from typing import Optional
from django.utils import timezone
from datetime import timedelta
from apps.common.logging_utils import get_logger
from apps.core.models import AlertConfiguration, AlertHistory

logger = get_logger(__name__)


class AlertThrottler:
    """
    Manages alert throttling to prevent duplicate alerts.
    """
    
    @staticmethod
    def should_throttle(alert_config: AlertConfiguration, alert_type: str) -> bool:
        """
        Check if alert should be throttled.
        
        Args:
            alert_config: Alert configuration
            alert_type: Type of alert ('failure' or 'timeout')
            
        Returns:
            True if alert should be throttled, False otherwise
        """
        # Calculate throttle window
        throttle_window = timedelta(minutes=alert_config.throttle_minutes)
        cutoff_time = timezone.now() - throttle_window
        
        # Check if an alert was sent recently for this config and type
        recent_alert = AlertHistory.objects.filter(
            alert_config=alert_config,
            alert_type=alert_type,
            sent_at__gte=cutoff_time,
            status='sent'
        ).first()
        
        if recent_alert:
            logger.info(
                f"Alert throttled for config {alert_config.id}, type {alert_type}",
                extra={
                    'alert_config_id': str(alert_config.id),
                    'alert_type': alert_type,
                    'throttle_minutes': alert_config.throttle_minutes
                }
            )
            return True
        
        return False
    
    @staticmethod
    def record_throttled_alert(
        alert_config: AlertConfiguration,
        run,
        alert_type: str,
        channel: str
    ) -> AlertHistory:
        """
        Record a throttled alert in history.
        
        Args:
            alert_config: Alert configuration
            run: Run instance
            alert_type: Type of alert
            channel: Notification channel
            
        Returns:
            Created AlertHistory instance
        """
        alert_history = AlertHistory.objects.create(
            alert_config=alert_config,
            run=run,
            alert_type=alert_type,
            channel=channel,
            status='throttled'
        )
        
        logger.info(
            f"Recorded throttled alert for run {run.id}",
            extra={
                'alert_config_id': str(alert_config.id),
                'run_id': str(run.id),
                'alert_type': alert_type,
                'channel': channel
            }
        )
        
        return alert_history

