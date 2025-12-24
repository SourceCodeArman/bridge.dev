"""
Core workflow data models for Bridge.dev

Includes Workflow, WorkflowVersion, Run, RunStep, and Trigger models.
"""
from django.db import models
from django.utils import timezone
import uuid
import json


class Workflow(models.Model):
    """
    Main workflow definition model
    
    Represents a workflow template that can have multiple versions.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('archived', 'Archived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    workspace = models.ForeignKey(
        'accounts.Workspace',
        on_delete=models.CASCADE,
        related_name='workflows'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    max_concurrent_runs = models.PositiveIntegerField(
        default=None,
        null=True,
        blank=True,
        help_text='Maximum concurrent runs for this workflow (uses default from settings if not set)'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workflows'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_workflow'
        verbose_name = 'Workflow'
        verbose_name_plural = 'Workflows'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['workspace', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.workspace})"
    
    def get_active_version(self):
        """Get the currently active version of this workflow"""
        return self.versions.filter(is_active=True).first()


class WorkflowVersion(models.Model):
    """
    Versioned workflow definition
    
    Each workflow can have multiple versions, with one active version.
    The definition is stored as JSON representing the workflow graph.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='versions'
    )
    version_number = models.PositiveIntegerField()
    definition = models.JSONField(help_text='Workflow graph definition (nodes and edges)')
    is_active = models.BooleanField(default=False, db_index=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workflow_versions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'core_workflowversion'
        verbose_name = 'Workflow Version'
        verbose_name_plural = 'Workflow Versions'
        unique_together = [['workflow', 'version_number']]
        ordering = ['workflow', '-version_number']
        indexes = [
            models.Index(fields=['workflow', 'is_active']),
            models.Index(fields=['workflow', 'version_number']),
        ]
    
    def __str__(self):
        return f"{self.workflow.name} v{self.version_number}"
    
    def save(self, *args, **kwargs):
        """Ensure only one active version per workflow"""
        if self.is_active:
            # Deactivate other versions
            WorkflowVersion.objects.filter(
                workflow=self.workflow,
                is_active=True
            ).exclude(id=self.id).update(is_active=False)
        super().save(*args, **kwargs)


class Run(models.Model):
    """
    Workflow execution instance
    
    Represents a single execution of a workflow version.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    TRIGGER_TYPE_CHOICES = [
        ('manual', 'Manual'),
        ('webhook', 'Webhook'),
        ('cron', 'Cron'),
        ('event', 'Event'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_version = models.ForeignKey(
        WorkflowVersion,
        on_delete=models.CASCADE,
        related_name='runs'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPE_CHOICES, default='manual')
    triggered_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='triggered_runs'
    )
    input_data = models.JSONField(default=dict, blank=True, help_text='Input data for the workflow run')
    output_data = models.JSONField(default=dict, blank=True, help_text='Output data from the workflow run')
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    idempotency_key = models.CharField(max_length=255, blank=True, db_index=True, help_text='Key for idempotent runs')
    
    class Meta:
        db_table = 'core_run'
        verbose_name = 'Run'
        verbose_name_plural = 'Runs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workflow_version', 'status']),
            models.Index(fields=['workflow_version', 'created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['idempotency_key']),
        ]
    
    def __str__(self):
        return f"Run {self.id} - {self.workflow_version.workflow.name} ({self.status})"
    
    @property
    def duration(self):
        """Calculate run duration in seconds"""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
    
    def can_transition_to(self, to_status: str) -> bool:
        """Check if run can transition to the given status"""
        from .state_machine import RunStateMachine
        return RunStateMachine.can_transition(self.status, to_status)
    
    def get_valid_transitions(self) -> list:
        """Get list of valid next statuses"""
        from .state_machine import RunStateMachine
        return RunStateMachine.get_valid_transitions(self.status)


class RunStep(models.Model):
    """
    Individual step execution within a run
    
    Tracks the execution of each node/step in the workflow.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        Run,
        on_delete=models.CASCADE,
        related_name='steps'
    )
    step_id = models.CharField(max_length=100, db_index=True, help_text='Step identifier from workflow definition')
    step_type = models.CharField(max_length=100, help_text='Type of step (e.g., http, slack, llm)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    inputs = models.JSONField(default=dict, blank=True, help_text='Input data for this step')
    outputs = models.JSONField(default=dict, blank=True, help_text='Output data from this step')
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0, help_text='Execution order within the run')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_runstep'
        verbose_name = 'Run Step'
        verbose_name_plural = 'Run Steps'
        ordering = ['run', 'order', 'created_at']
        indexes = [
            models.Index(fields=['run', 'status']),
            models.Index(fields=['run', 'order']),
            models.Index(fields=['run', 'step_id']),
        ]
    
    def __str__(self):
        return f"Step {self.step_id} in Run {self.run.id} ({self.status})"
    
    def can_transition_to(self, to_status: str) -> bool:
        """Check if step can transition to the given status"""
        from .state_machine import RunStepStateMachine
        return RunStepStateMachine.can_transition(self.status, to_status)
    
    def get_valid_transitions(self) -> list:
        """Get list of valid next statuses"""
        from .state_machine import RunStepStateMachine
        return RunStepStateMachine.get_valid_transitions(self.status)
    
    def validate_input_schema(self) -> bool:
        """Validate step inputs against schema"""
        from .validators import validate_step_inputs
        try:
            validate_step_inputs(self.step_type, self.inputs)
            return True
        except Exception:
            return False
    
    def validate_output_schema(self) -> bool:
        """Validate step outputs against schema"""
        from .validators import validate_step_outputs
        try:
            validate_step_outputs(self.step_type, self.outputs)
            return True
        except Exception:
            return False


class Trigger(models.Model):
    """
    Workflow trigger definitions
    
    Defines how a workflow can be triggered (webhook, cron, manual, etc.)
    """
    TRIGGER_TYPE_CHOICES = [
        ('webhook', 'Webhook'),
        ('cron', 'Cron'),
        ('manual', 'Manual'),
        ('event', 'Event'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='triggers'
    )
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPE_CHOICES, db_index=True)
    config = models.JSONField(default=dict, help_text='Trigger-specific configuration')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_trigger'
        verbose_name = 'Trigger'
        verbose_name_plural = 'Triggers'
        ordering = ['workflow', 'trigger_type']
        indexes = [
            models.Index(fields=['workflow', 'is_active']),
            models.Index(fields=['trigger_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.workflow.name} - {self.get_trigger_type_display()}"


class Credential(models.Model):
    """
    Credential model for storing encrypted API keys and authentication tokens.
    
    Credentials are scoped to workspaces and encrypted at rest.
    """
    CREDENTIAL_TYPE_CHOICES = [
        ('api_key', 'API Key'),
        ('oauth_token', 'OAuth Token'),
        ('basic_auth', 'Basic Auth'),
        ('custom', 'Custom'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text='Human-readable name for the credential')
    credential_type = models.CharField(
        max_length=50,
        choices=CREDENTIAL_TYPE_CHOICES,
        db_index=True,
        help_text='Type of credential'
    )
    workspace = models.ForeignKey(
        'accounts.Workspace',
        on_delete=models.CASCADE,
        related_name='credentials',
        help_text='Workspace this credential belongs to'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_credentials'
    )
    encrypted_data = models.TextField(help_text='Encrypted credential data (JSON)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_credential'
        verbose_name = 'Credential'
        verbose_name_plural = 'Credentials'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'credential_type']),
            models.Index(fields=['workspace', 'created_at']),
            models.Index(fields=['workspace', 'name']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_credential_type_display()}) - {self.workspace}"


class CredentialUsage(models.Model):
    """
    Track which workflows use which credentials.
    
    This helps with credential management and auditing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    credential = models.ForeignKey(
        Credential,
        on_delete=models.CASCADE,
        related_name='usage_records'
    )
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='credential_usage'
    )
    last_used_at = models.DateTimeField(null=True, blank=True, help_text='Last time this credential was used')
    usage_count = models.PositiveIntegerField(default=0, help_text='Number of times this credential has been used')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_credentialusage'
        verbose_name = 'Credential Usage'
        verbose_name_plural = 'Credential Usages'
        unique_together = [['credential', 'workflow']]
        indexes = [
            models.Index(fields=['credential', 'workflow']),
            models.Index(fields=['workflow', 'last_used_at']),
        ]
    
    def __str__(self):
        return f"{self.credential.name} used by {self.workflow.name}"


class RunLog(models.Model):
    """
    Structured log entries for workflow runs and steps.
    
    Stores logs with correlation IDs for efficient querying and tracing.
    """
    LEVEL_CHOICES = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('CRITICAL', 'Critical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        Run,
        on_delete=models.CASCADE,
        related_name='logs',
        help_text='Workflow run this log belongs to'
    )
    step = models.ForeignKey(
        RunStep,
        on_delete=models.CASCADE,
        related_name='logs',
        null=True,
        blank=True,
        help_text='Step this log belongs to (null for run-level logs)'
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, db_index=True)
    message = models.TextField(help_text='Log message')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True, help_text='Log timestamp')
    correlation_id = models.CharField(max_length=255, blank=True, db_index=True, help_text='Correlation ID for tracing')
    extra_data = models.JSONField(default=dict, blank=True, help_text='Additional log data (JSON)')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'core_runlog'
        verbose_name = 'Run Log'
        verbose_name_plural = 'Run Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['run', 'timestamp']),
            models.Index(fields=['step', 'timestamp']),
            models.Index(fields=['run', 'level']),
            models.Index(fields=['correlation_id', 'timestamp']),
            models.Index(fields=['run', 'step', 'timestamp']),
        ]
    
    def __str__(self):
        step_info = f" (step: {self.step.step_id})" if self.step else ""
        return f"{self.level} - {self.run.id}{step_info} - {self.message[:50]}"


class RunTrace(models.Model):
    """
    Aggregated trace data for workflow runs.
    
    Stores complete trace structure for fast retrieval and visualization.
    Updated incrementally as the run progresses.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.OneToOneField(
        Run,
        on_delete=models.CASCADE,
        related_name='trace',
        help_text='Workflow run this trace belongs to'
    )
    trace_data = models.JSONField(default=dict, help_text='Complete trace structure (JSON)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_runtrace'
        verbose_name = 'Run Trace'
        verbose_name_plural = 'Run Traces'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['run']),
            models.Index(fields=['updated_at']),
        ]
    
    def __str__(self):
        return f"Trace for Run {self.run.id}"

