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
    ConversationThread,
    ChatMessage,
)
from .encryption import get_encryption_service
from .connectors.validator import validate_custom_connector_manifest
from django.db import transaction
from django.utils.text import slugify
from django.conf import settings
from supabase import create_client
import uuid
import os
import logging

logger = logging.getLogger(__name__)


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
            "icon_url_light",
            "icon_url_dark",
            "is_active",
            "connector_type",
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
            "is_active",
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
        # Use prefetched cache if available
        if hasattr(obj, "active_versions_cache"):
            return (
                obj.active_versions_cache[0].version_number
                if obj.active_versions_cache
                else None
            )
        # Fallback to original method
        active_version = obj.get_active_version()
        return active_version.version_number if active_version else None

    def get_last_run_at(self, obj):
        # Use annotated field if available (much faster)
        if hasattr(obj, "last_run_timestamp"):
            return obj.last_run_timestamp

        # Fallback to original query
        from .models import Run

        last_run = (
            Run.objects.filter(workflow_version__workflow=obj)
            .order_by("-created_at")
            .first()
        )
        return last_run.created_at if last_run else None

    def get_trigger_type(self, obj):
        # Use prefetched cache if available
        if hasattr(obj, "active_triggers_cache"):
            return (
                obj.active_triggers_cache[0].trigger_type
                if obj.active_triggers_cache
                else None
            )
        # Fallback to original method
        active_trigger = obj.triggers.filter(is_active=True).first()
        return active_trigger.trigger_type if active_trigger else None

    def get_current_version(self, obj):
        """Get the most recent version (draft or active) - includes graph for canvas rendering"""
        # Use prefetched cache if available
        if hasattr(obj, "latest_version_cache"):
            last_version = (
                obj.latest_version_cache[0] if obj.latest_version_cache else None
            )
        else:
            # For detail views, we need the definition; for list views, we don't
            view = self.context.get("view")
            is_detail_view = view and getattr(view, "action", None) == "retrieve"

            if is_detail_view:
                # Load full version with definition for detail view
                last_version = obj.versions.order_by("-created_at").first()
            else:
                # Use only() to avoid loading large definition field for list views
                last_version = (
                    obj.versions.only(
                        "id", "version_number", "workflow_id", "is_active", "created_at"
                    )
                    .order_by("-created_at")
                    .first()
                )

        if last_version:
            # For detail views, include graph (which points to definition)
            view = self.context.get("view")
            is_detail_view = view and getattr(view, "action", None) == "retrieve"

            if is_detail_view and hasattr(last_version, "definition"):
                return {
                    "id": str(last_version.id),
                    "version_number": last_version.version_number,
                    "is_active": last_version.is_active,
                    "created_at": last_version.created_at,
                    "graph": last_version.definition,  # Frontend expects 'graph'
                }
            else:
                # Return minimal data for list views
                return {
                    "id": str(last_version.id),
                    "version_number": last_version.version_number,
                    "is_active": last_version.is_active,
                    "created_at": last_version.created_at,
                }
        return None


class WorkflowListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Workflow list view - optimized for performance"""

    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    active_version_number = serializers.SerializerMethodField()
    last_run_at = serializers.SerializerMethodField()
    trigger_type = serializers.SerializerMethodField()

    class Meta:
        model = Workflow
        fields = (
            "id",
            "name",
            "description",
            "workspace",
            "workspace_name",
            "status",
            "is_active",
            "active_version_number",
            "last_run_at",
            "trigger_type",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "workspace", "created_at", "updated_at")

    def get_active_version_number(self, obj):
        """Get active version number from prefetched cache"""
        if hasattr(obj, "active_versions_cache") and obj.active_versions_cache:
            return obj.active_versions_cache[0].version_number
        return None

    def get_last_run_at(self, obj):
        """Get last run timestamp from annotated field"""
        return getattr(obj, "last_run_timestamp", None)

    def get_trigger_type(self, obj):
        """Get trigger type from prefetched cache"""
        if hasattr(obj, "active_triggers_cache") and obj.active_triggers_cache:
            return obj.active_triggers_cache[0].trigger_type
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
            "created_manually",
            "version_label",
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
    slug = serializers.SerializerMethodField()

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
            "slug",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_slug(self, obj):
        """Extract connector slug from encrypted data and normalize to hyphen format"""
        try:
            encryption_service = get_encryption_service()
            data = encryption_service.decrypt_dict(obj.encrypted_data)
            slug = data.get("_connector_id")

            if slug:
                # Normalize legacy underscore format to hyphen format
                # e.g., google_sheets -> google-sheets, google_calendar -> google-calendar
                slug = slug.replace("_", "-")

                # Handle special case: google-gmail -> gmail (to match actual connector slug)
                if slug == "google-gmail":
                    slug = "gmail"

            return slug
        except Exception:
            return None


class CredentialCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating credentials (includes plaintext data)"""

    data = serializers.DictField(
        write_only=True, help_text="Plaintext credential data to encrypt and store"
    )

    class Meta:
        model = Credential
        fields = ("name", "credential_type", "workspace", "data")
        read_only_fields = ("workspace",)

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
    manifest_file = serializers.FileField(write_only=True)
    light_icon = serializers.ImageField(write_only=True, required=False)
    dark_icon = serializers.ImageField(write_only=True, required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = CustomConnector
        fields = (
            "id",
            "workspace",
            "workspace_name",
            "slug",
            "display_name",
            "description",
            "icon_url_light",
            "icon_url_dark",
            "visibility",
            "status",
            "current_version",
            "current_version_info",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
            "manifest_file",
            "light_icon",
            "dark_icon",
        )
        read_only_fields = (
            "id",
            "workspace",
            "created_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        """Ensure slug is unique per workspace at the serializer level."""
        request = self.context.get("request")
        workspace = attrs.get("workspace") or getattr(self.instance, "workspace", None)

        # If workspace not in attrs/instance, try to get from request like the view does
        if not workspace and request:
            workspace = getattr(request, "workspace", None)

            # Fallback logic for workspace matching view logic
            if not workspace and request.user and request.user.is_authenticated:
                from apps.accounts.models import OrganizationMember

                membership = OrganizationMember.objects.filter(
                    user=request.user, is_active=True
                ).first()
                if membership:
                    workspace = membership.organization.workspaces.first()

        # Auto-generate slug if not provided
        if not attrs.get("slug"):
            display_name = attrs.get("display_name")
            if display_name:
                slug_candidate = slugify(display_name)
                # Ensure we have a valid slug, default to "custom-connector" if empty
                attrs["slug"] = slug_candidate or "custom-connector"

        slug = attrs.get("slug") or getattr(self.instance, "slug", None)

        if workspace and slug:
            qs = CustomConnector.objects.filter(workspace=workspace, slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "slug": [
                            f"A connector with the slug '{slug}' already exists in this workspace."
                        ]
                    }
                )
        return super().validate(attrs)

    def create(self, validated_data):
        manifest_file = validated_data.pop("manifest_file")
        light_icon = validated_data.pop("light_icon", None)
        dark_icon = validated_data.pop("dark_icon", None)

        # Handle icon uploads to Supabase Storage
        supabase_url = settings.SUPABASE_URL
        supabase_key = (
            settings.SUPABASE_SERVICE_KEY
            or settings.SUPABASE_KEY
            or os.environ.get("SUPABASE_API_KEY")
        )

        has_supabase = bool(supabase_url and supabase_key)

        if has_supabase:
            try:
                supabase = create_client(supabase_url, supabase_key)

                # Helper function to upload icon
                def upload_icon(icon_file):
                    if not icon_file:
                        return None

                    file_ext = os.path.splitext(icon_file.name)[1]
                    file_path = f"connectors/{uuid.uuid4()}{file_ext}"

                    # Read file content
                    file_content = icon_file.read()

                    # Upload to Supabase
                    supabase.storage.from_("custom-connector-icons").upload(
                        file_path,
                        file_content,
                        {"content-type": icon_file.content_type},
                    )

                    # Get public URL
                    return supabase.storage.from_(
                        "custom-connector-icons"
                    ).get_public_url(file_path)

                # Upload icons if present
                import logging

                logger = logging.getLogger(__name__)
                logger.info(
                    f"Supabase configured: {has_supabase}. Light icon: {bool(light_icon)}, Dark icon: {bool(dark_icon)}"
                )

                if light_icon:
                    try:
                        validated_data["icon_url_light"] = upload_icon(light_icon)
                        logger.info(
                            f"Uploaded light icon: {validated_data.get('icon_url_light')}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to upload light icon: {e}")

                if dark_icon:
                    try:
                        validated_data["icon_url_dark"] = upload_icon(dark_icon)
                        logger.info(
                            f"Uploaded dark icon: {validated_data.get('icon_url_dark')}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to upload dark icon: {e}")

            except Exception as e:
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"Failed to upload icons to Supabase: {str(e)}")

        try:
            import json

            # If manifest_file was read before, ensure we start from 0
            manifest_file.seek(0)
            manifest_data = json.loads(manifest_file.read().decode("utf-8"))
            validate_custom_connector_manifest(manifest_data)
        except Exception as e:
            raise serializers.ValidationError(
                {"manifest_file": f"Invalid manifest: {str(e)}"}
            )

        with transaction.atomic():
            connector = CustomConnector.objects.create(**validated_data)

            # Create initial draft version
            version = CustomConnectorVersion.objects.create(
                connector=connector,
                version=manifest_data.get("version", "1.0.0"),
                manifest=manifest_data,
                status="draft",
                created_by=validated_data.get("created_by"),
            )

            # Set as current version
            connector.current_version = version
            connector.save(update_fields=["current_version"])

        return connector

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
            "manifest": version.manifest,
        }


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage model"""

    class Meta:
        model = ChatMessage
        fields = (
            "id",
            "thread",
            "role",
            "content",
            "actions",
            "metadata",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class ConversationThreadSerializer(serializers.ModelSerializer):
    """Serializer for ConversationThread model"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ConversationThread
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "title",
            "is_active",
            "messages",
            "message_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_message_count(self, obj):
        """Get message count from annotated field for performance"""
        if hasattr(obj, "message_count_cached"):
            return obj.message_count_cached
        return obj.messages.count()


class ConversationThreadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation list (no messages)"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    message_count = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()

    class Meta:
        model = ConversationThread
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "title",
            "is_active",
            "message_count",
            "last_message_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_message_count(self, obj):
        """Get message count from annotated field for performance"""
        if hasattr(obj, "message_count_cached"):
            return obj.message_count_cached
        return obj.messages.count()

    def get_last_message_at(self, obj):
        """Get last message timestamp efficiently"""
        if hasattr(obj, "last_message_at_cached"):
            return obj.last_message_at_cached
        last_msg = obj.messages.order_by("-created_at").first()
        return last_msg.created_at if last_msg else None


class AIChatRequestSerializer(serializers.Serializer):
    """Serializer for AI chat request"""

    message = serializers.CharField(
        required=True,
        max_length=10000,
        min_length=1,
        help_text="User message to send to AI assistant (1-10000 chars)",
    )
    llm_provider = serializers.ChoiceField(
        choices=["openai", "anthropic", "gemini", "deepseek"],
        default="gemini",
        required=False,
        help_text="LLM provider to use",
    )
    include_workflow_context = serializers.BooleanField(
        default=True,
        required=False,
        help_text="Whether to include current workflow state in context",
    )
    thread_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Optional thread ID to use for this message",
    )
    stream = serializers.BooleanField(
        default=True,
        required=False,
        help_text="Whether to stream the response",
    )


class CreateThreadSerializer(serializers.Serializer):
    """Serializer for creating a new conversation thread"""

    title = serializers.CharField(
        required=False,
        max_length=200,
        allow_blank=True,
        help_text="Optional title for the conversation thread",
    )
