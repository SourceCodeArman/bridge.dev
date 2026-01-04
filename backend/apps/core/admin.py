"""
Django Admin configuration for core models.

Registers all core models with the Django admin interface.
"""

from django.contrib import admin
from .models import (
    Workflow,
    WorkflowVersion,
    Run,
    RunStep,
    Trigger,
    Credential,
    CredentialUsage,
    CustomConnector,
    Connector,
    CustomConnectorVersion,
    RunLog,
    RunTrace,
    LLMUsage,
    AlertConfiguration,
    AlertHistory,
    ErrorSuggestion,
    WorkflowTemplate,
    WorkflowComment,
    WorkflowPresence,
)


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "workspace",
        "status",
        "is_active",
        "created_by",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "is_active", "workspace")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-updated_at",)


@admin.register(WorkflowVersion)
class WorkflowVersionAdmin(admin.ModelAdmin):
    list_display = (
        "workflow",
        "version_number",
        "is_active",
        "created_manually",
        "created_at",
    )
    list_filter = ("is_active", "created_manually")
    search_fields = ("workflow__name", "version_label")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(Run)
class RunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "workflow_version",
        "status",
        "trigger_type",
        "started_at",
        "completed_at",
    )
    list_filter = ("status", "trigger_type")
    search_fields = ("id", "workflow_version__workflow__name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-started_at",)


@admin.register(RunStep)
class RunStepAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "run",
        "step_id",
        "step_type",
        "status",
        "order",
        "started_at",
    )
    list_filter = ("status", "step_type")
    search_fields = ("step_id", "run__id")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("run", "order")


@admin.register(Trigger)
class TriggerAdmin(admin.ModelAdmin):
    list_display = ("id", "workflow", "trigger_type", "is_active", "created_at")
    list_filter = ("trigger_type", "is_active")
    search_fields = ("workflow__name",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ("name", "credential_type", "workspace", "created_by", "created_at")
    list_filter = ("credential_type", "workspace")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(CredentialUsage)
class CredentialUsageAdmin(admin.ModelAdmin):
    list_display = ("credential", "workflow", "created_at")
    list_filter = ("workflow",)
    readonly_fields = ("id", "created_at")


@admin.register(CustomConnector)
class CustomConnectorAdmin(admin.ModelAdmin):
    list_display = ("display_name", "slug", "workspace", "created_by", "created_at")
    list_filter = ("workspace",)
    search_fields = ("display_name", "slug", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Connector)
class ConnectorAdmin(admin.ModelAdmin):
    list_display = ("display_name", "slug", "connector_type", "is_active", "created_at")
    list_filter = ("connector_type", "is_active")
    search_fields = ("display_name", "slug", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(CustomConnectorVersion)
class CustomConnectorVersionAdmin(admin.ModelAdmin):
    list_display = ("connector", "version", "status", "created_at")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at")


@admin.register(RunLog)
class RunLogAdmin(admin.ModelAdmin):
    list_display = ("run", "step", "level", "timestamp")
    list_filter = ("level",)
    search_fields = ("message",)
    readonly_fields = ("id", "created_at")
    ordering = ("-timestamp",)


@admin.register(RunTrace)
class RunTraceAdmin(admin.ModelAdmin):
    list_display = ("run", "created_at")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)


@admin.register(LLMUsage)
class LLMUsageAdmin(admin.ModelAdmin):
    list_display = ("run_step", "model", "provider", "total_tokens", "created_at")
    list_filter = ("provider", "model")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)


@admin.register(AlertConfiguration)
class AlertConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "workflow",
        "enabled",
        "alert_on_failure",
        "alert_on_timeout",
        "created_at",
    )
    list_filter = ("enabled", "alert_on_failure", "alert_on_timeout")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AlertHistory)
class AlertHistoryAdmin(admin.ModelAdmin):
    list_display = ("alert_config", "run", "alert_type", "channel", "status", "sent_at")
    list_filter = ("alert_type", "channel", "status")
    readonly_fields = ("id", "sent_at")
    ordering = ("-sent_at",)


@admin.register(ErrorSuggestion)
class ErrorSuggestionAdmin(admin.ModelAdmin):
    list_display = ("run_step", "error_type", "confidence", "actionable", "created_at")
    list_filter = ("error_type", "actionable")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)


@admin.register(WorkflowTemplate)
class WorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_public", "usage_count", "created_at")
    list_filter = ("category", "is_public")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(WorkflowComment)
class WorkflowCommentAdmin(admin.ModelAdmin):
    list_display = ("workflow_version", "created_by", "node_id", "created_at")
    search_fields = ("content",)
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(WorkflowPresence)
class WorkflowPresenceAdmin(admin.ModelAdmin):
    list_display = ("workflow_version", "user", "is_active", "last_seen_at")
    list_filter = ("is_active",)
    readonly_fields = ("id",)
    ordering = ("-last_seen_at",)
