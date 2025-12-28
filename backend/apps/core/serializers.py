"""
Serializers for core app
"""

from rest_framework import serializers
from .models import (
    Workflow,
    WorkflowVersion,
    Run,
    RunStep,
    Trigger,
    Credential,
    CredentialUsage,
    RunLog,
    RunTrace,
    AlertConfiguration,
    AlertHistory,
    ErrorSuggestion,
    WorkflowTemplate,
    WorkflowComment,
    WorkflowPresence,
    CustomConnector,
    CustomConnectorVersion,
    Connector,
)
from .encryption import get_encryption_service
from .connectors.validator import validate_custom_connector_manifest


class ConnectorSerializer(serializers.ModelSerializer):
    """Serializer for Connector model"""

    class Meta:
        model = Connector
        fields = [
            "id",
            "slug",
            "display_name",
            "description",
            "version",
            "manifest",
            "icon_url",
            "is_active",
        ]


class WorkflowSerializer(serializers.ModelSerializer):
    """Serializer for Workflow model"""

    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    active_version_number = serializers.SerializerMethodField()
    last_run_at = serializers.SerializerMethodField()
    trigger_type = serializers.SerializerMethodField()
    current_version = serializers.SerializerMethodField()

    class Meta:
        model = Workflow
        fields = (
            "id",
            "name",
            "description",
            "workspace",
            "workspace_name",
            "status",
            "active_version_number",
            "current_version",
            "last_run_at",
            "trigger_type",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "workspace", "created_at", "updated_at")

    def get_active_version_number(self, obj):
        active_version = obj.get_active_version()
        return active_version.version_number if active_version else None

    def get_last_run_at(self, obj):
        from .models import Run

        last_run = (
            Run.objects.filter(workflow_version__workflow=obj)
            .order_by("-created_at")
            .first()
        )
        return last_run.created_at if last_run else None

    def get_trigger_type(self, obj):
        active_trigger = obj.triggers.filter(is_active=True).first()
        return active_trigger.trigger_type if active_trigger else None

    def get_current_version(self, obj):
        """Get the most recent version (draft or active)"""
        last_version = obj.versions.order_by("-created_at").first()
        if last_version:
            return WorkflowVersionSerializer(last_version).data
        return None


class WorkflowVersionSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowVersion model"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    graph = serializers.JSONField(source="definition", read_only=True)

    class Meta:
        model = WorkflowVersion
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "version_number",
            "definition",
            "graph",
            "is_active",
            "created_by",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class RunStepSerializer(serializers.ModelSerializer):
    """Serializer for RunStep model"""

    class Meta:
        model = RunStep
        fields = (
            "id",
            "run",
            "step_id",
            "step_type",
            "status",
            "inputs",
            "outputs",
            "error_message",
            "started_at",
            "completed_at",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class RunSerializer(serializers.ModelSerializer):
    """Serializer for Run model"""

    workflow_name = serializers.CharField(
        source="workflow_version.workflow.name", read_only=True
    )
    workflow_version_number = serializers.IntegerField(
        source="workflow_version.version_number", read_only=True
    )
    steps = RunStepSerializer(many=True, read_only=True)
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Run
        fields = (
            "id",
            "workflow_version",
            "workflow_name",
            "workflow_version_number",
            "status",
            "trigger_type",
            "triggered_by",
            "input_data",
            "output_data",
            "error_message",
            "started_at",
            "completed_at",
            "duration",
            "idempotency_key",
            "steps",
            "created_at",
            "updated_at",
            "original_run",
            "replay_type",
            "replay_from_step_id",
            "saved_input_data",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_duration(self, obj):
        return obj.duration


class TriggerSerializer(serializers.ModelSerializer):
    """Serializer for Trigger model"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)

    class Meta:
        model = Trigger
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "trigger_type",
            "config",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class WebhookTriggerSerializer(serializers.Serializer):
    """Serializer for webhook trigger payload"""

    # Allow any JSON data - validation will be done by the workflow definition
    def to_internal_value(self, data):
        # Accept any JSON structure
        if isinstance(data, dict):
            return data
        return super().to_internal_value(data)

    def to_representation(self, instance):
        return instance


class ManualTriggerSerializer(serializers.Serializer):
    """Serializer for manual trigger request"""

    input_data = serializers.DictField(
        required=False, default=dict, help_text="Input data for the workflow run"
    )

    def validate_input_data(self, value):
        """Validate input_data is a dictionary"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("input_data must be a dictionary")
        return value


class CredentialListSerializer(serializers.ModelSerializer):
    """Serializer for listing credentials (masked data)"""

    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)

    class Meta:
        model = Credential
        fields = (
            "id",
            "name",
            "credential_type",
            "workspace",
            "workspace_name",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CredentialCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating credentials (includes plaintext data)"""

    data = serializers.DictField(
        write_only=True, help_text="Plaintext credential data to encrypt and store"
    )

    class Meta:
        model = Credential
        fields = ("name", "credential_type", "workspace", "data")

    def validate_data(self, value):
        """Validate that data is a dictionary"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("data must be a dictionary")
        if not value:
            raise serializers.ValidationError("data cannot be empty")
        return value

    def create(self, validated_data):
        """Create credential with encrypted data"""
        data = validated_data.pop("data")
        encryption_service = get_encryption_service()

        # Encrypt the data
        encrypted_data = encryption_service.encrypt_dict(data)

        # Set created_by from request user
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        # Create credential with encrypted data
        credential = Credential.objects.create(
            **validated_data, encrypted_data=encrypted_data
        )

        return credential


class CredentialUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating credentials"""

    data = serializers.DictField(
        required=False,
        write_only=True,
        help_text="Plaintext credential data to encrypt and store (optional)",
    )

    class Meta:
        model = Credential
        fields = ("name", "data")

    def validate_data(self, value):
        """Validate that data is a dictionary"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("data must be a dictionary")
        return value

    def update(self, instance, validated_data):
        """Update credential, encrypting data if provided"""
        data = validated_data.pop("data", None)

        if data is not None:
            # Encrypt the new data
            encryption_service = get_encryption_service()
            instance.encrypted_data = encryption_service.encrypt_dict(data)

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class CredentialDetailSerializer(serializers.ModelSerializer):
    """Serializer for credential detail view (includes decrypted data)"""

    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)
    data = serializers.SerializerMethodField()

    class Meta:
        model = Credential
        fields = (
            "id",
            "name",
            "credential_type",
            "workspace",
            "workspace_name",
            "created_by",
            "created_by_email",
            "data",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_data(self, obj):
        """Decrypt and return credential data"""
        try:
            encryption_service = get_encryption_service()
            return encryption_service.decrypt_dict(obj.encrypted_data)
        except Exception as e:
            # If decryption fails, return error indicator
            return {"_error": f"Failed to decrypt: {str(e)}"}


class CredentialUsageSerializer(serializers.ModelSerializer):
    """Serializer for credential usage tracking"""

    credential_name = serializers.CharField(source="credential.name", read_only=True)
    workflow_name = serializers.CharField(source="workflow.name", read_only=True)

    class Meta:
        model = CredentialUsage
        fields = (
            "id",
            "credential",
            "credential_name",
            "workflow",
            "workflow_name",
            "last_used_at",
            "usage_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "last_used_at",
            "usage_count",
        )


class RunLogSerializer(serializers.ModelSerializer):
    """Serializer for RunLog entries"""

    step_id = serializers.CharField(
        source="step.step_id", read_only=True, allow_null=True
    )
    run_id = serializers.UUIDField(source="run.id", read_only=True)

    class Meta:
        model = RunLog
        fields = (
            "id",
            "run_id",
            "step_id",
            "level",
            "message",
            "timestamp",
            "correlation_id",
            "extra_data",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class TraceStepSerializer(serializers.Serializer):
    """Serializer for step trace data"""

    step_id = serializers.CharField()
    step_type = serializers.CharField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.FloatField(allow_null=True)
    error_message = serializers.CharField(allow_null=True)
    inputs_keys = serializers.ListField(child=serializers.CharField())
    outputs_keys = serializers.ListField(child=serializers.CharField())
    logs = RunLogSerializer(many=True)
    log_summary = serializers.DictField()


class RunTraceSerializer(serializers.ModelSerializer):
    """Serializer for RunTrace"""

    run_id = serializers.UUIDField(source="run.id", read_only=True)
    workflow_name = serializers.CharField(
        source="run.workflow_version.workflow.name", read_only=True
    )
    trace_data = serializers.JSONField()

    class Meta:
        model = RunTrace
        fields = (
            "id",
            "run_id",
            "workflow_name",
            "trace_data",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AlertConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AlertConfiguration"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)

    class Meta:
        model = AlertConfiguration
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "alert_on_failure",
            "alert_on_timeout",
            "timeout_seconds",
            "notification_channels",
            "email_recipients",
            "slack_webhook_url",
            "webhook_url",
            "throttle_minutes",
            "enabled",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_notification_channels(self, value):
        """Validate notification channels"""
        valid_channels = ["email", "slack", "webhook"]
        if not isinstance(value, list):
            raise serializers.ValidationError("notification_channels must be a list")
        for channel in value:
            if channel not in valid_channels:
                raise serializers.ValidationError(
                    f"Invalid channel: {channel}. Must be one of {valid_channels}"
                )
        return value

    def validate_email_recipients(self, value):
        """Validate email recipients"""
        if not isinstance(value, list):
            raise serializers.ValidationError("email_recipients must be a list")
        # Basic email validation
        import re

        email_pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        for email in value:
            if not email_pattern.match(email):
                raise serializers.ValidationError(f"Invalid email address: {email}")
        return value


class AlertHistorySerializer(serializers.ModelSerializer):
    """Serializer for AlertHistory"""

    alert_config_id = serializers.UUIDField(source="alert_config.id", read_only=True)
    run_id = serializers.UUIDField(source="run.id", read_only=True)
    workflow_name = serializers.CharField(
        source="run.workflow_version.workflow.name", read_only=True
    )

    class Meta:
        model = AlertHistory
        fields = (
            "id",
            "alert_config_id",
            "run_id",
            "workflow_name",
            "alert_type",
            "channel",
            "sent_at",
            "status",
            "error_message",
        )
        read_only_fields = ("id", "sent_at")


class ErrorSuggestionSerializer(serializers.ModelSerializer):
    """Serializer for ErrorSuggestion"""

    run_step_id = serializers.UUIDField(source="run_step.id", read_only=True)
    step_id = serializers.CharField(source="run_step.step_id", read_only=True)
    step_type = serializers.CharField(source="run_step.step_type", read_only=True)
    run_id = serializers.UUIDField(source="run_step.run.id", read_only=True)
    workflow_name = serializers.CharField(
        source="run_step.run.workflow_version.workflow.name", read_only=True
    )

    class Meta:
        model = ErrorSuggestion
        fields = (
            "id",
            "run_step_id",
            "step_id",
            "step_type",
            "run_id",
            "workflow_name",
            "error_type",
            "suggestion",
            "confidence",
            "actionable",
            "fix_data",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class FormFieldSchemaSerializer(serializers.Serializer):
    """Serializer for form field schema"""

    field_id = serializers.CharField()
    type = serializers.CharField()
    label = serializers.CharField()
    required = serializers.BooleanField()
    description = serializers.CharField(required=False, allow_blank=True)
    default = serializers.JSONField(required=False, allow_null=True)
    validation = serializers.DictField(required=False, allow_null=True)
    enum_values = serializers.ListField(required=False, allow_null=True)
    item_type = serializers.CharField(required=False, allow_null=True)


class FormSchemaSerializer(serializers.Serializer):
    """Serializer for form schema response"""

    connector_id = serializers.CharField()
    action_id = serializers.CharField()
    action_name = serializers.CharField()
    action_description = serializers.CharField(required=False, allow_blank=True)
    fields = FormFieldSchemaSerializer(many=True)
    output_schema = serializers.DictField(required=False, allow_null=True)


class NodeValidationRequestSerializer(serializers.Serializer):
    """Serializer for node validation request"""

    connector_id = serializers.CharField(required=True)
    action_id = serializers.CharField(required=True)
    config = serializers.DictField(required=True)


class NodeValidationResponseSerializer(serializers.Serializer):
    """Serializer for node validation response"""

    valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField())
    field_errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField())
    )


class WorkflowGenerateRequestSerializer(serializers.Serializer):
    """Serializer for workflow generation request"""

    prompt = serializers.CharField(
        required=True, help_text="Natural language description of the workflow"
    )
    llm_provider = serializers.ChoiceField(
        choices=["openai", "anthropic", "gemini", "deepseek"],
        default="openai",
        required=False,
        help_text="LLM provider to use for generation",
    )


class WorkflowTemplateListSerializer(serializers.ModelSerializer):
    """Serializer for template list view (public fields only)"""

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = WorkflowTemplate
        fields = (
            "id",
            "name",
            "description",
            "category",
            "is_public",
            "usage_count",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "usage_count")


class WorkflowTemplateDetailSerializer(serializers.ModelSerializer):
    """Serializer for template detail view (includes full definition)"""

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = WorkflowTemplate
        fields = (
            "id",
            "name",
            "description",
            "category",
            "definition",
            "is_public",
            "usage_count",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "usage_count")


class WorkflowTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating templates (admin/curation)"""

    class Meta:
        model = WorkflowTemplate
        fields = ("name", "description", "category", "definition", "is_public")

    def validate_definition(self, value):
        """Validate workflow definition structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Definition must be a dictionary")

        if "nodes" not in value:
            raise serializers.ValidationError('Definition must contain "nodes" field')

        if not isinstance(value.get("nodes", []), list):
            raise serializers.ValidationError("Nodes must be a list")

        return value


class WorkflowCommentSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowComment model"""

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    resolved_by_email = serializers.EmailField(
        source="resolved_by.email", read_only=True
    )
    is_resolved = serializers.BooleanField(read_only=True)

    class Meta:
        model = WorkflowComment
        fields = (
            "id",
            "workflow_version",
            "node_id",
            "edge_id",
            "content",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
            "resolved_at",
            "resolved_by",
            "resolved_by_email",
            "is_resolved",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by_email",
            "resolved_by_email",
            "is_resolved",
        )

    def validate(self, data):
        """Validate that either node_id or edge_id is provided"""
        node_id = data.get("node_id")
        edge_id = data.get("edge_id")

        if not node_id and not edge_id:
            raise serializers.ValidationError(
                "Either node_id or edge_id must be provided"
            )

        if node_id and edge_id:
            raise serializers.ValidationError("Cannot specify both node_id and edge_id")

        return data


class WorkflowPresenceSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowPresence model"""

    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = WorkflowPresence
        fields = (
            "id",
            "workflow_version",
            "user",
            "user_email",
            "user_name",
            "node_id",
            "last_seen_at",
            "is_active",
        )
        read_only_fields = ("id", "last_seen_at", "user_email", "user_name")


class CustomConnectorVersionSerializer(serializers.ModelSerializer):
    """Serializer for CustomConnectorVersion model."""

    connector_slug = serializers.SlugField(source="connector.slug", read_only=True)
    connector_display_name = serializers.CharField(
        source="connector.display_name", read_only=True
    )

    class Meta:
        model = CustomConnectorVersion
        fields = (
            "id",
            "connector",
            "connector_slug",
            "connector_display_name",
            "version",
            "manifest",
            "changelog",
            "status",
            "created_by",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate_manifest(self, value):
        """Validate manifest using the custom connector manifest validator."""
        is_valid, errors = validate_custom_connector_manifest(value)
        if not is_valid:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, attrs):
        """Enforce per-connector version uniqueness with clear error messages."""
        connector = attrs.get("connector") or getattr(self.instance, "connector", None)
        version = attrs.get("version") or getattr(self.instance, "version", None)

        if connector and version:
            qs = CustomConnectorVersion.objects.filter(
                connector=connector, version=version
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "version": [
                            "This version already exists for the selected connector."
                        ]
                    }
                )
        return super().validate(attrs)


class CustomConnectorSerializer(serializers.ModelSerializer):
    """Serializer for CustomConnector model."""

    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    current_version_info = serializers.SerializerMethodField()

    class Meta:
        model = CustomConnector
        fields = (
            "id",
            "workspace",
            "workspace_name",
            "slug",
            "display_name",
            "description",
            "visibility",
            "status",
            "current_version",
            "current_version_info",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "current_version_info")

    def validate(self, attrs):
        """Ensure slug is unique per workspace at the serializer level."""
        workspace = attrs.get("workspace") or getattr(self.instance, "workspace", None)
        slug = attrs.get("slug") or getattr(self.instance, "slug", None)

        if workspace and slug:
            qs = CustomConnector.objects.filter(workspace=workspace, slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "slug": [
                            "A connector with this slug already exists in the workspace."
                        ]
                    }
                )
        return super().validate(attrs)

    def get_current_version_info(self, obj):
        """Return a minimal summary of the current version, if set."""
        version = obj.current_version
        if not version:
            return None
        return {
            "id": str(version.id),
            "version": version.version,
            "status": version.status,
            "created_at": version.created_at,
        }
