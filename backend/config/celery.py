"""
Celery configuration for Bridge.dev

This module configures Celery for distributed task processing with Redis as the broker.
"""
import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('bridge')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Configure task routes
app.conf.task_routes = {
    'apps.core.tasks.execute_workflow_run': {'queue': 'workflows'},
    'apps.core.tasks.execute_run_step': {'queue': 'steps'},
    'apps.core.tasks.retry_failed_step': {'queue': 'retries'},
    'apps.core.tasks.check_and_trigger_cron_workflows': {'queue': 'scheduler'},
}

# Configure task defaults
app.conf.task_default_queue = 'default'
app.conf.task_default_exchange = 'tasks'
app.conf.task_default_routing_key = 'default'

# Task serialization
app.conf.task_serializer = 'json'
app.conf.accept_content = ['json']
app.conf.result_serializer = 'json'
app.conf.timezone = 'UTC'
app.conf.enable_utc = True

# Task retry configuration
app.conf.task_acks_late = True
app.conf.task_reject_on_worker_lost = True
app.conf.worker_prefetch_multiplier = 1

# Dead Letter Queue configuration
app.conf.task_default_delivery_mode = 'persistent'
app.conf.task_reject_on_worker_lost = True

# Result backend configuration
app.conf.result_expires = 3600  # 1 hour

@app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup"""
    print(f'Request: {self.request!r}')

