# Generated migration for AlertConfiguration and AlertHistory models

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_llm_usage_model'),
    ]

    operations = [
        migrations.CreateModel(
            name='AlertConfiguration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('alert_on_failure', models.BooleanField(default=True, help_text='Send alert when workflow run fails')),
                ('alert_on_timeout', models.BooleanField(default=True, help_text='Send alert when workflow run times out')),
                ('timeout_seconds', models.PositiveIntegerField(blank=True, help_text='Timeout threshold in seconds (uses default from settings if not set)', null=True)),
                ('notification_channels', models.JSONField(default=list, help_text='List of notification channels: ["email", "slack", "webhook"]')),
                ('email_recipients', models.JSONField(default=list, help_text='List of email addresses to receive alerts')),
                ('slack_webhook_url', models.CharField(blank=True, help_text='Slack webhook URL for alerts', max_length=500)),
                ('webhook_url', models.CharField(blank=True, help_text='Webhook URL for alerts', max_length=500)),
                ('throttle_minutes', models.PositiveIntegerField(default=15, help_text='Throttle window in minutes (prevent duplicate alerts)')),
                ('enabled', models.BooleanField(db_index=True, default=True, help_text='Whether this alert configuration is enabled')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('workflow', models.ForeignKey(help_text='Workflow this alert configuration belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='alert_configurations', to='core.workflow')),
            ],
            options={
                'verbose_name': 'Alert Configuration',
                'verbose_name_plural': 'Alert Configurations',
                'db_table': 'core_alertconfiguration',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AlertHistory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('alert_type', models.CharField(choices=[('failure', 'Failure'), ('timeout', 'Timeout')], db_index=True, help_text='Type of alert (failure or timeout)', max_length=20)),
                ('channel', models.CharField(choices=[('email', 'Email'), ('slack', 'Slack'), ('webhook', 'Webhook')], db_index=True, help_text='Notification channel used', max_length=20)),
                ('sent_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('status', models.CharField(choices=[('sent', 'Sent'), ('failed', 'Failed'), ('throttled', 'Throttled')], db_index=True, default='sent', help_text='Status of the alert', max_length=20)),
                ('error_message', models.TextField(blank=True, help_text='Error message if alert sending failed')),
                ('alert_config', models.ForeignKey(help_text='Alert configuration used', on_delete=django.db.models.deletion.CASCADE, related_name='alert_history', to='core.alertconfiguration')),
                ('run', models.ForeignKey(help_text='Workflow run that triggered the alert', on_delete=django.db.models.deletion.CASCADE, related_name='alert_history', to='core.run')),
            ],
            options={
                'verbose_name': 'Alert History',
                'verbose_name_plural': 'Alert Histories',
                'db_table': 'core_alerthistory',
                'ordering': ['-sent_at'],
            },
        ),
        migrations.AddIndex(
            model_name='alertconfiguration',
            index=models.Index(fields=['workflow', 'enabled'], name='core_alertc_workflow_enabled_idx'),
        ),
        migrations.AddIndex(
            model_name='alertconfiguration',
            index=models.Index(fields=['enabled'], name='core_alertc_enabled_idx'),
        ),
        migrations.AddIndex(
            model_name='alerthistory',
            index=models.Index(fields=['alert_config', 'sent_at'], name='core_alerth_alert_config_sent_idx'),
        ),
        migrations.AddIndex(
            model_name='alerthistory',
            index=models.Index(fields=['run', 'sent_at'], name='core_alerth_run_sent_idx'),
        ),
        migrations.AddIndex(
            model_name='alerthistory',
            index=models.Index(fields=['alert_type', 'sent_at'], name='core_alerth_alert_type_sent_idx'),
        ),
        migrations.AddIndex(
            model_name='alerthistory',
            index=models.Index(fields=['status', 'sent_at'], name='core_alerth_status_sent_idx'),
        ),
    ]

