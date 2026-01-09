"""
Views package for core app.

Re-exports all ViewSets for backward compatibility with existing imports.
"""

# Workflow-related views
from .workflows import WorkflowViewSet, WorkflowVersionViewSet

# Run-related views
from .runs import RunViewSet, RunStepViewSet

# Trigger-related views
from .triggers import TriggerViewSet, WebhookTriggerView

# Credential-related views
from .credentials import CredentialViewSet

# Connector-related views
from .connectors import (
    ConnectorViewSet,
    CustomConnectorViewSet,
    CustomConnectorVersionViewSet,
)

# Observability-related views
from .observability import (
    RunLogViewSet,
    RunTraceViewSet,
    AlertConfigurationViewSet,
    AlertHistoryViewSet,
    ErrorSuggestionViewSet,
)

# Collaboration-related views
from .collaboration import WorkflowCommentViewSet, WorkflowPresenceViewSet

# Template-related views
from .templates import WorkflowTemplateViewSet


__all__ = [
    # Workflows
    "WorkflowViewSet",
    "WorkflowVersionViewSet",
    # Runs
    "RunViewSet",
    "RunStepViewSet",
    # Triggers
    "TriggerViewSet",
    "WebhookTriggerView",
    # Credentials
    "CredentialViewSet",
    # Connectors
    "ConnectorViewSet",
    "CustomConnectorViewSet",
    "CustomConnectorVersionViewSet",
    # Observability
    "RunLogViewSet",
    "RunTraceViewSet",
    "AlertConfigurationViewSet",
    "AlertHistoryViewSet",
    "ErrorSuggestionViewSet",
    # Collaboration
    "WorkflowCommentViewSet",
    "WorkflowPresenceViewSet",
    # Templates
    "WorkflowTemplateViewSet",
]
