"""
Notification senders for alert system.

Provides email, Slack, and webhook notification capabilities.
"""
from typing import Dict, Any
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import requests
from apps.common.logging_utils import get_logger
from apps.core.models import Run, AlertConfiguration, AlertHistory

logger = get_logger(__name__)


class AlertNotifier:
    """
    Base class for alert notifiers.
    """
    
    @staticmethod
    def format_alert_message(run: Run, alert_type: str) -> Dict[str, Any]:
        """
        Format alert message with run details.
        
        Args:
            run: Run instance
            alert_type: Type of alert ('failure' or 'timeout')
            
        Returns:
            Dictionary with formatted message data
        """
        workflow = run.workflow_version.workflow
        
        message_data = {
            'workflow_name': workflow.name,
            'workflow_id': str(workflow.id),
            'run_id': str(run.id),
            'alert_type': alert_type,
            'status': run.status,
            'error_message': run.error_message or 'No error message',
            'started_at': run.started_at.isoformat() if run.started_at else None,
            'completed_at': run.completed_at.isoformat() if run.completed_at else None,
            'timestamp': timezone.now().isoformat(),
        }
        
        # Add step information if available
        failed_steps = run.steps.filter(status='failed')
        if failed_steps.exists():
            message_data['failed_steps'] = [
                {
                    'step_id': step.step_id,
                    'step_type': step.step_type,
                    'error_message': step.error_message
                }
                for step in failed_steps
            ]
        
        return message_data


class EmailNotifier(AlertNotifier):
    """
    Email notification sender.
    """
    
    @staticmethod
    def send(
        alert_config: AlertConfiguration,
        run: Run,
        alert_type: str
    ) -> AlertHistory:
        """
        Send email alert.
        
        Args:
            alert_config: Alert configuration
            run: Run instance
            alert_type: Type of alert
            
        Returns:
            AlertHistory instance
        """
        recipients = alert_config.email_recipients
        if not recipients or len(recipients) == 0:
            raise ValueError("No email recipients configured")
        
        message_data = EmailNotifier.format_alert_message(run, alert_type)
        
        # Format email subject
        subject = f"[Bridge.dev] Workflow {message_data['workflow_name']} - {alert_type.title()}"
        
        # Format email body
        body_lines = [
            f"Workflow: {message_data['workflow_name']}",
            f"Run ID: {message_data['run_id']}",
            f"Alert Type: {alert_type.title()}",
            f"Status: {message_data['status']}",
            "",
            f"Error Message: {message_data['error_message']}",
            "",
        ]
        
        if message_data.get('failed_steps'):
            body_lines.append("Failed Steps:")
            for step in message_data['failed_steps']:
                body_lines.append(f"  - {step['step_id']} ({step['step_type']}): {step['error_message']}")
            body_lines.append("")
        
        body_lines.extend([
            f"Started At: {message_data['started_at'] or 'N/A'}",
            f"Completed At: {message_data['completed_at'] or 'N/A'}",
            "",
            f"View run: {getattr(settings, 'FRONTEND_URL', '')}/runs/{message_data['run_id']}",
        ])
        
        body = "\n".join(body_lines)
        
        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@bridge.dev')
            
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=recipients,
                fail_silently=False
            )
            
            # Record successful alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='email',
                status='sent'
            )
            
            logger.info(
                f"Email alert sent for run {run.id}",
                extra={
                    'run_id': str(run.id),
                    'recipients': recipients,
                    'alert_type': alert_type
                }
            )
            
            return alert_history
            
        except Exception as e:
            # Record failed alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='email',
                status='failed',
                error_message=str(e)
            )
            
            logger.error(
                f"Failed to send email alert for run {run.id}: {str(e)}",
                exc_info=e,
                extra={'run_id': str(run.id), 'error': str(e)}
            )
            
            raise


class SlackNotifier(AlertNotifier):
    """
    Slack notification sender.
    """
    
    @staticmethod
    def send(
        alert_config: AlertConfiguration,
        run: Run,
        alert_type: str
    ) -> AlertHistory:
        """
        Send Slack alert via webhook.
        
        Args:
            alert_config: Alert configuration
            run: Run instance
            alert_type: Type of alert
            
        Returns:
            AlertHistory instance
        """
        webhook_url = alert_config.slack_webhook_url
        if not webhook_url:
            raise ValueError("Slack webhook URL not configured")
        
        message_data = SlackNotifier.format_alert_message(run, alert_type)
        
        # Format Slack message
        color = "danger" if alert_type == "failure" else "warning"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Workflow {alert_type.title()}: {message_data['workflow_name']}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Run ID:*\n{message_data['run_id']}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:*\n{message_data['status']}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Error:*\n```{message_data['error_message']}```"
                }
            }
        ]
        
        if message_data.get('failed_steps'):
            step_text = "\n".join([
                f"• {step['step_id']} ({step['step_type']}): {step['error_message'][:100]}"
                for step in message_data['failed_steps']
            ])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Failed Steps:*\n{step_text}"
                }
            })
        
        payload = {
            "blocks": blocks,
            "attachments": [
                {
                    "color": color,
                    "footer": f"Bridge.dev • {message_data['timestamp']}"
                }
            ]
        }
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            
            # Record successful alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='slack',
                status='sent'
            )
            
            logger.info(
                f"Slack alert sent for run {run.id}",
                extra={'run_id': str(run.id), 'alert_type': alert_type}
            )
            
            return alert_history
            
        except Exception as e:
            # Record failed alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='slack',
                status='failed',
                error_message=str(e)
            )
            
            logger.error(
                f"Failed to send Slack alert for run {run.id}: {str(e)}",
                exc_info=e,
                extra={'run_id': str(run.id), 'error': str(e)}
            )
            
            raise


class WebhookNotifier(AlertNotifier):
    """
    Webhook notification sender.
    """
    
    @staticmethod
    def send(
        alert_config: AlertConfiguration,
        run: Run,
        alert_type: str
    ) -> AlertHistory:
        """
        Send webhook alert.
        
        Args:
            alert_config: Alert configuration
            run: Run instance
            alert_type: Type of alert
            
        Returns:
            AlertHistory instance
        """
        webhook_url = alert_config.webhook_url
        if not webhook_url:
            raise ValueError("Webhook URL not configured")
        
        message_data = WebhookNotifier.format_alert_message(run, alert_type)
        
        payload = {
            'event': 'workflow_alert',
            'alert_type': alert_type,
            'data': message_data
        }
        
        try:
            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            response.raise_for_status()
            
            # Record successful alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='webhook',
                status='sent'
            )
            
            logger.info(
                f"Webhook alert sent for run {run.id}",
                extra={'run_id': str(run.id), 'alert_type': alert_type}
            )
            
            return alert_history
            
        except Exception as e:
            # Record failed alert
            alert_history = AlertHistory.objects.create(
                alert_config=alert_config,
                run=run,
                alert_type=alert_type,
                channel='webhook',
                status='failed',
                error_message=str(e)
            )
            
            logger.error(
                f"Failed to send webhook alert for run {run.id}: {str(e)}",
                exc_info=e,
                extra={'run_id': str(run.id), 'error': str(e)}
            )
            
            raise

