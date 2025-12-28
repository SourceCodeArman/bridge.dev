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
        ("draft", "Draft"),
        ("active", "Active"),
        ("archived", "Archived"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    workspace = models.ForeignKey(
        "accounts.Workspace", on_delete=models.CASCADE, related_name="workflows"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True
    )
    max_concurrent_runs = models.PositiveIntegerField(
        default=None,
        null=True,
        blank=True,
        help_text="Maximum concurrent runs for this workflow (uses default from settings if not set)",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_workflows",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_workflow"
        verbose_name = "Workflow"
        verbose_name_plural = "Workflows"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "created_at"]),
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
        Workflow, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    definition = models.JSONField(
        help_text="Workflow graph definition (nodes and edges)"
    )
    is_active = models.BooleanField(default=False, db_index=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_workflow_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_workflowversion"
        verbose_name = "Workflow Version"
        verbose_name_plural = "Workflow Versions"
        unique_together = [["workflow", "version_number"]]
        ordering = ["workflow", "-version_number"]
        indexes = [
            models.Index(fields=["workflow", "is_active"]),
            models.Index(fields=["workflow", "version_number"]),
        ]

    def __str__(self):
        return f"{self.workflow.name} v{self.version_number}"

    def save(self, *args, **kwargs):
        """Ensure only one active version per workflow"""
        if self.is_active:
            # Deactivate other versions
            WorkflowVersion.objects.filter(
                workflow=self.workflow, is_active=True
            ).exclude(id=self.id).update(is_active=False)
        super().save(*args, **kwargs)


class Run(models.Model):
    """
    Workflow execution instance

    Represents a single execution of a workflow version.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    TRIGGER_TYPE_CHOICES = [
        ("manual", "Manual"),
        ("webhook", "Webhook"),
        ("cron", "Cron"),
        ("event", "Event"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_version = models.ForeignKey(
        WorkflowVersion, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True
    )
    trigger_type = models.CharField(
        max_length=20, choices=TRIGGER_TYPE_CHOICES, default="manual"
    )
    triggered_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="triggered_runs",
    )
    input_data = models.JSONField(
        default=dict, blank=True, help_text="Input data for the workflow run"
    )
    output_data = models.JSONField(
        default=dict, blank=True, help_text="Output data from the workflow run"
    )
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    idempotency_key = models.CharField(
        max_length=255, blank=True, db_index=True, help_text="Key for idempotent runs"
    )

    # Replay fields
    original_run = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replay_runs",
        help_text="Original run this replay is based on (null for original runs)",
    )
    replay_type = models.CharField(
        max_length=20,
        choices=[
            ("full", "Full Replay"),
            ("partial", "Partial Replay"),
        ],
        null=True,
        blank=True,
        db_index=True,
        help_text="Type of replay (full or partial)",
    )
    replay_from_step_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Step ID to replay from (for partial replays)",
    )
    saved_input_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Saved input data from original run for replay purposes",
    )

    class Meta:
        db_table = "core_run"
        verbose_name = "Run"
        verbose_name_plural = "Runs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workflow_version", "status"]),
            models.Index(fields=["workflow_version", "created_at"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["idempotency_key"]),
            models.Index(fields=["original_run", "created_at"]),
            models.Index(fields=["replay_type", "created_at"]),
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

    def save_for_replay(self):
        """Explicitly mark run as replayable by saving input data"""
        if not self.saved_input_data:
            self.saved_input_data = self.input_data.copy()
            self.save(update_fields=["saved_input_data"])

    def get_replay_lineage(self) -> list:
        """Get replay lineage (list of runs in the replay chain)"""
        lineage = []
        current = self

        # Traverse back to original run
        while current:
            lineage.insert(
                0,
                {
                    "run_id": str(current.id),
                    "status": current.status,
                    "created_at": current.created_at.isoformat()
                    if current.created_at
                    else None,
                    "replay_type": current.replay_type,
                },
            )
            current = current.original_run

        return lineage


class RunStep(models.Model):
    """
    Individual step execution within a run

    Tracks the execution of each node/step in the workflow.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(Run, on_delete=models.CASCADE, related_name="steps")
    step_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Step identifier from workflow definition",
    )
    step_type = models.CharField(
        max_length=100, help_text="Type of step (e.g., http, slack, llm)"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True
    )
    inputs = models.JSONField(
        default=dict, blank=True, help_text="Input data for this step"
    )
    outputs = models.JSONField(
        default=dict, blank=True, help_text="Output data from this step"
    )
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(
        default=0, help_text="Execution order within the run"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_runstep"
        verbose_name = "Run Step"
        verbose_name_plural = "Run Steps"
        ordering = ["run", "order", "created_at"]
        indexes = [
            models.Index(fields=["run", "status"]),
            models.Index(fields=["run", "order"]),
            models.Index(fields=["run", "step_id"]),
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
        ("webhook", "Webhook"),
        ("cron", "Cron"),
        ("manual", "Manual"),
        ("event", "Event"),
        ("supabase_realtime", "Supabase Realtime"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow, on_delete=models.CASCADE, related_name="triggers"
    )
    trigger_type = models.CharField(
        max_length=20, choices=TRIGGER_TYPE_CHOICES, db_index=True
    )
    config = models.JSONField(default=dict, help_text="Trigger-specific configuration")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_trigger"
        verbose_name = "Trigger"
        verbose_name_plural = "Triggers"
        ordering = ["workflow", "trigger_type"]
        indexes = [
            models.Index(fields=["workflow", "is_active"]),
            models.Index(fields=["trigger_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.workflow.name} - {self.get_trigger_type_display()}"


class Credential(models.Model):
    """
    Credential model for storing encrypted API keys and authentication tokens.

    Credentials are scoped to workspaces and encrypted at rest.
    """

    CREDENTIAL_TYPE_CHOICES = [
        ("api_key", "API Key"),
        ("oauth_token", "OAuth Token"),
        ("basic_auth", "Basic Auth"),
        ("custom", "Custom"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=200, help_text="Human-readable name for the credential"
    )
    credential_type = models.CharField(
        max_length=50,
        choices=CREDENTIAL_TYPE_CHOICES,
        db_index=True,
        help_text="Type of credential",
    )
    workspace = models.ForeignKey(
        "accounts.Workspace",
        on_delete=models.CASCADE,
        related_name="credentials",
        help_text="Workspace this credential belongs to",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_credentials",
    )
    encrypted_data = models.TextField(help_text="Encrypted credential data (JSON)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_credential"
        verbose_name = "Credential"
        verbose_name_plural = "Credentials"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "credential_type"]),
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["workspace", "name"]),
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
        Credential, on_delete=models.CASCADE, related_name="usage_records"
    )
    workflow = models.ForeignKey(
        Workflow, on_delete=models.CASCADE, related_name="credential_usage"
    )
    last_used_at = models.DateTimeField(
        null=True, blank=True, help_text="Last time this credential was used"
    )
    usage_count = models.PositiveIntegerField(
        default=0, help_text="Number of times this credential has been used"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_credentialusage"
        verbose_name = "Credential Usage"
        verbose_name_plural = "Credential Usages"
        unique_together = [["credential", "workflow"]]
        indexes = [
            models.Index(fields=["credential", "workflow"]),
            models.Index(fields=["workflow", "last_used_at"]),
        ]

    def __str__(self):
        return f"{self.credential.name} used by {self.workflow.name}"


class CustomConnector(models.Model):
    """
    User-contributed connector definition.

    Stores metadata for custom connectors scoped to a workspace, including
    visibility and publication status.
    """

    VISIBILITY_CHOICES = [
        ("private", "Private"),
        ("workspace", "Workspace"),
        ("public", "Public"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("deprecated", "Deprecated"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        "accounts.Workspace",
        on_delete=models.CASCADE,
        related_name="custom_connectors",
        help_text="Workspace this custom connector belongs to",
    )
    slug = models.SlugField(
        max_length=200, help_text="Unique slug for this connector within the workspace"
    )
    display_name = models.CharField(
        max_length=200, help_text="Human-readable name for this connector"
    )
    description = models.TextField(
        blank=True, help_text="Description of what this connector does"
    )
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default="workspace",
        db_index=True,
        help_text="Visibility of this connector",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
        help_text="Publication status of this connector",
    )
    current_version = models.ForeignKey(
        "CustomConnectorVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Currently active/approved version for this connector",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_custom_connectors",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_customconnector"
        verbose_name = "Custom Connector"
        verbose_name_plural = "Custom Connectors"
        ordering = ["-created_at"]
        unique_together = [["workspace", "slug"]]
        indexes = [
            models.Index(fields=["workspace", "slug"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "visibility"]),
        ]

    def __str__(self):
        return f"{self.display_name} ({self.workspace})"


class Connector(models.Model):
    """
    Built-in system connectors (e.g., OpenAI, Slack, etc.)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(
        max_length=200, unique=True, help_text="Unique identifier for the connector"
    )
    display_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    version = models.CharField(max_length=50, default="1.0.0")
    manifest = models.JSONField(help_text="Connector manifest definition")
    icon_url = models.URLField(blank=True, null=True, help_text="URL to connector icon")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_connector"
        verbose_name = "Connector"
        verbose_name_plural = "Connectors"
        ordering = ["display_name"]

    def __str__(self):
        return self.display_name


class CustomConnectorVersion(models.Model):
    """
    Versioned manifest for a user-contributed connector.

    Each version stores its manifest JSON and review status.
    """

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("deprecated", "Deprecated"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    connector = models.ForeignKey(
        CustomConnector,
        on_delete=models.CASCADE,
        related_name="versions",
        help_text="Custom connector this version belongs to",
    )
    version = models.CharField(
        max_length=50, help_text="Semantic version string (e.g., 1.0.0)"
    )
    manifest = models.JSONField(help_text="Connector manifest JSON for this version")
    changelog = models.TextField(
        blank=True, help_text="Optional changelog or notes for this version"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
        help_text="Review/approval status for this version",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_custom_connector_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_customconnectorversion"
        verbose_name = "Custom Connector Version"
        verbose_name_plural = "Custom Connector Versions"
        ordering = ["connector", "-created_at"]
        unique_together = [["connector", "version"]]
        indexes = [
            models.Index(fields=["connector", "version"]),
            models.Index(fields=["connector", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.connector.display_name} v{self.version}"


class RunLog(models.Model):
    """
    Structured log entries for workflow runs and steps.

    Stores logs with correlation IDs for efficient querying and tracing.
    """

    LEVEL_CHOICES = [
        ("DEBUG", "Debug"),
        ("INFO", "Info"),
        ("WARNING", "Warning"),
        ("ERROR", "Error"),
        ("CRITICAL", "Critical"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        Run,
        on_delete=models.CASCADE,
        related_name="logs",
        help_text="Workflow run this log belongs to",
    )
    step = models.ForeignKey(
        RunStep,
        on_delete=models.CASCADE,
        related_name="logs",
        null=True,
        blank=True,
        help_text="Step this log belongs to (null for run-level logs)",
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, db_index=True)
    message = models.TextField(help_text="Log message")
    timestamp = models.DateTimeField(
        auto_now_add=True, db_index=True, help_text="Log timestamp"
    )
    correlation_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="Correlation ID for tracing",
    )
    extra_data = models.JSONField(
        default=dict, blank=True, help_text="Additional log data (JSON)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_runlog"
        verbose_name = "Run Log"
        verbose_name_plural = "Run Logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["run", "timestamp"]),
            models.Index(fields=["step", "timestamp"]),
            models.Index(fields=["run", "level"]),
            models.Index(fields=["correlation_id", "timestamp"]),
            models.Index(fields=["run", "step", "timestamp"]),
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
        related_name="trace",
        help_text="Workflow run this trace belongs to",
    )
    trace_data = models.JSONField(
        default=dict, help_text="Complete trace structure (JSON)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_runtrace"
        verbose_name = "Run Trace"
        verbose_name_plural = "Run Traces"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["run"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self):
        return f"Trace for Run {self.run.id}"


class LLMUsage(models.Model):
    """
    Track LLM API usage and cost metadata for workflow steps.

    Stores token usage and estimated costs for LLM connector calls.
    """

    PROVIDER_CHOICES = [
        ("openai", "OpenAI"),
        ("anthropic", "Anthropic"),
        ("gemini", "Gemini"),
        ("deepseek", "DeepSeek"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_step = models.ForeignKey(
        RunStep,
        on_delete=models.CASCADE,
        related_name="llm_usage",
        help_text="Workflow step that used the LLM",
    )
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        db_index=True,
        help_text="LLM provider name",
    )
    model = models.CharField(
        max_length=100,
        help_text="Model name used (e.g., gpt-3.5-turbo, claude-3-5-sonnet)",
    )
    input_tokens = models.PositiveIntegerField(
        default=0, help_text="Number of input tokens used"
    )
    output_tokens = models.PositiveIntegerField(
        default=0, help_text="Number of output tokens generated"
    )
    total_tokens = models.PositiveIntegerField(
        default=0, help_text="Total tokens used (input + output)"
    )
    estimated_cost = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Estimated cost in USD (if calculable)",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "core_llmusage"
        verbose_name = "LLM Usage"
        verbose_name_plural = "LLM Usages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["run_step", "created_at"]),
            models.Index(fields=["provider", "created_at"]),
            models.Index(fields=["provider", "model"]),
        ]

    def __str__(self):
        return f"{self.provider} - {self.model} - {self.total_tokens} tokens"


class AlertConfiguration(models.Model):
    """
    Alert configuration for workflows.

    Defines when and how to send alerts for workflow failures and timeouts.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name="alert_configurations",
        help_text="Workflow this alert configuration belongs to",
    )
    alert_on_failure = models.BooleanField(
        default=True, help_text="Send alert when workflow run fails"
    )
    alert_on_timeout = models.BooleanField(
        default=True, help_text="Send alert when workflow run times out"
    )
    timeout_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Timeout threshold in seconds (uses default from settings if not set)",
    )
    notification_channels = models.JSONField(
        default=list,
        help_text='List of notification channels: ["email", "slack", "webhook"]',
    )
    email_recipients = models.JSONField(
        default=list, help_text="List of email addresses to receive alerts"
    )
    slack_webhook_url = models.CharField(
        max_length=500, blank=True, help_text="Slack webhook URL for alerts"
    )
    webhook_url = models.CharField(
        max_length=500, blank=True, help_text="Webhook URL for alerts"
    )
    throttle_minutes = models.PositiveIntegerField(
        default=15, help_text="Throttle window in minutes (prevent duplicate alerts)"
    )
    enabled = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this alert configuration is enabled",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_alertconfiguration"
        verbose_name = "Alert Configuration"
        verbose_name_plural = "Alert Configurations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workflow", "enabled"]),
            models.Index(fields=["enabled"]),
        ]

    def __str__(self):
        return f"Alert config for {self.workflow.name}"


class AlertHistory(models.Model):
    """
    History of sent alerts.

    Tracks alert sending for throttling and auditing purposes.
    """

    ALERT_TYPE_CHOICES = [
        ("failure", "Failure"),
        ("timeout", "Timeout"),
    ]

    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("slack", "Slack"),
        ("webhook", "Webhook"),
    ]

    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("failed", "Failed"),
        ("throttled", "Throttled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_config = models.ForeignKey(
        AlertConfiguration,
        on_delete=models.CASCADE,
        related_name="alert_history",
        help_text="Alert configuration used",
    )
    run = models.ForeignKey(
        Run,
        on_delete=models.CASCADE,
        related_name="alert_history",
        help_text="Workflow run that triggered the alert",
    )
    alert_type = models.CharField(
        max_length=20,
        choices=ALERT_TYPE_CHOICES,
        db_index=True,
        help_text="Type of alert (failure or timeout)",
    )
    channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
        db_index=True,
        help_text="Notification channel used",
    )
    sent_at = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="sent",
        db_index=True,
        help_text="Status of the alert",
    )
    error_message = models.TextField(
        blank=True, help_text="Error message if alert sending failed"
    )

    class Meta:
        db_table = "core_alerthistory"
        verbose_name = "Alert History"
        verbose_name_plural = "Alert Histories"
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["alert_config", "sent_at"]),
            models.Index(fields=["run", "sent_at"]),
            models.Index(fields=["alert_type", "sent_at"]),
            models.Index(fields=["status", "sent_at"]),
        ]

    def __str__(self):
        return f"Alert {self.alert_type} via {self.channel} for run {self.run.id}"


class ErrorSuggestion(models.Model):
    """
    AI-generated error fix suggestions for failed workflow steps.

    Stores suggestions generated by LLM analysis of step failures.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_step = models.ForeignKey(
        RunStep,
        on_delete=models.CASCADE,
        related_name="error_suggestions",
        help_text="Failed step this suggestion applies to",
    )
    error_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Category of error (e.g., authentication_error, validation_error)",
    )
    suggestion = models.TextField(
        help_text="Human-readable suggestion for fixing the error"
    )
    confidence = models.FloatField(default=0.0, help_text="Confidence score (0.0-1.0)")
    actionable = models.BooleanField(
        default=True, help_text="Whether this suggestion can be automatically applied"
    )
    fix_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured fix data (e.g., corrected input values)",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "core_errorsuggestion"
        verbose_name = "Error Suggestion"
        verbose_name_plural = "Error Suggestions"
        ordering = ["-confidence", "-created_at"]
        indexes = [
            models.Index(fields=["run_step", "created_at"]),
            models.Index(fields=["error_type", "created_at"]),
            models.Index(fields=["confidence"]),
        ]

    def __str__(self):
        return f"Suggestion for {self.run_step.step_id} ({self.error_type}) - confidence: {self.confidence:.2f}"


class WorkflowTemplate(models.Model):
    """
    Workflow template for the templates and recipes library.

    Stores reusable workflow definitions that users can clone into their drafts.
    """

    CATEGORY_CHOICES = [
        ("webhook", "Webhook"),
        ("database", "Database"),
        ("automation", "Automation"),
        ("integration", "Integration"),
        ("notification", "Notification"),
        ("data-processing", "Data Processing"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text="Template name")
    description = models.TextField(blank=True, help_text="Template description")
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        db_index=True,
        help_text="Template category",
    )
    definition = models.JSONField(
        help_text="Workflow graph definition (nodes and edges)"
    )
    is_public = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether template is available to all workspaces",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_templates",
        help_text="User who created this template",
    )
    usage_count = models.PositiveIntegerField(
        default=0, help_text="Number of times this template has been cloned"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_workflowtemplate"
        verbose_name = "Workflow Template"
        verbose_name_plural = "Workflow Templates"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "is_public"]),
            models.Index(fields=["is_public", "created_at"]),
            models.Index(fields=["category", "created_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"

    def increment_usage(self):
        """Increment usage count when template is cloned"""
        self.usage_count += 1
        self.save(update_fields=["usage_count"])


class WorkflowComment(models.Model):
    """
    Comments on workflow nodes and edges for collaboration.

    Allows users to add comments to specific nodes or edges in a workflow version.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_version = models.ForeignKey(
        WorkflowVersion,
        on_delete=models.CASCADE,
        related_name="comments",
        help_text="Workflow version this comment belongs to",
    )
    node_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        help_text="ID of node being commented on",
    )
    edge_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        help_text="ID of edge being commented on (if commenting on edge)",
    )
    content = models.TextField(help_text="Comment content")
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="workflow_comments",
        help_text="User who created this comment",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When comment was marked as resolved",
    )
    resolved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_comments",
        help_text="User who resolved this comment",
    )

    class Meta:
        db_table = "core_workflowcomment"
        verbose_name = "Workflow Comment"
        verbose_name_plural = "Workflow Comments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workflow_version", "node_id"]),
            models.Index(fields=["workflow_version", "created_at"]),
            models.Index(fields=["workflow_version", "resolved_at"]),
        ]

    def __str__(self):
        target = (
            f"node {self.node_id}"
            if self.node_id
            else f"edge {self.edge_id}"
            if self.edge_id
            else "workflow"
        )
        return f"Comment on {target} by {self.created_by.email}"

    def resolve(self, user):
        """Mark comment as resolved"""
        from django.utils import timezone

        self.resolved_at = timezone.now()
        self.resolved_by = user
        self.save(update_fields=["resolved_at", "resolved_by", "updated_at"])

    def unresolve(self):
        """Mark comment as unresolved"""
        self.resolved_at = None
        self.resolved_by = None
        self.save(update_fields=["resolved_at", "resolved_by", "updated_at"])

    @property
    def is_resolved(self):
        """Check if comment is resolved"""
        return self.resolved_at is not None


class WorkflowPresence(models.Model):
    """
    Presence tracking for workflow collaboration.

    Tracks which users are currently viewing/editing a workflow version.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_version = models.ForeignKey(
        WorkflowVersion,
        on_delete=models.CASCADE,
        related_name="presence",
        help_text="Workflow version being viewed",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="workflow_presence",
        help_text="User with presence",
    )
    node_id = models.CharField(
        max_length=100, null=True, blank=True, help_text="Currently focused node ID"
    )
    last_seen_at = models.DateTimeField(
        auto_now=True, db_index=True, help_text="Last time user was seen (auto-updated)"
    )
    is_active = models.BooleanField(
        default=True, db_index=True, help_text="Whether user is currently active"
    )

    class Meta:
        db_table = "core_workflowpresence"
        verbose_name = "Workflow Presence"
        verbose_name_plural = "Workflow Presences"
        unique_together = [["workflow_version", "user"]]
        indexes = [
            models.Index(fields=["workflow_version", "is_active"]),
            models.Index(fields=["workflow_version", "last_seen_at"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.email} on {self.workflow_version.workflow.name}"

    def update_presence(self, node_id=None):
        """Update presence timestamp and optionally node focus"""
        from django.utils import timezone

        self.last_seen_at = timezone.now()
        self.is_active = True
        if node_id is not None:
            self.node_id = node_id
        self.save(update_fields=["last_seen_at", "is_active", "node_id"])

    def deactivate(self):
        """Mark presence as inactive"""
        self.is_active = False
        self.save(update_fields=["is_active"])
